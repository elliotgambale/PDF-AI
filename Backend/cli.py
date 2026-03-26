"""
CLI for PDF parsing, DB setup, ingestion, and chat using docopt.

Usage:
  cli.py init-db
  cli.py clear-db
  cli.py ingest <file_path> [--start-page=<start>] [--end-page=<end>]
  cli.py parse <file_path> [--start-page=<start>] [--end-page=<end>]
  cli.py chat
  cli.py (-h | --help)

Options:
  -h --help     Show this screen.
  --start-page=<start>  Start page number (1-indexed) [default: 1]
  --end-page=<end>      End page number (1-indexed, optional)

Commands:
  init-db       Initialize database (drop and recreate table with vector index)
  clear-db      Clear all data from the database table
  ingest        Parse PDF and ingest content into database with embeddings
  parse         Parse PDF and display content groups without ingesting
  chat          Interactive chat using RAG with embedded content
"""

import sys
import re
import json
import requests
from docopt import docopt

try:
    from PyPDF2 import PdfReader
except ImportError:
    print("Error: PyPDF2 not installed. Run: pip install PyPDF2")
    sys.exit(1)

# ——— Configuration ———
DB_KEY = "sfPSIeynsX8sKCs6SiyDw:6Ld_wa8f5ZpBfQiSdALwMt3OOpQ-xlldo4iqsaYFS:storage"
DB_BASE = "https://api.db.llmosaic.ai"
LLM_KEY = "FFSBAmawo2m0d6LL-zpKh:cXNAGajBrMZTS4J8Mn99el0rXyFCAmwYkmwdNRj_j:Llama3.1-8B-Instruct"
LLM_BASE = "https://gpu1.llmosaic.ai"
EMBED_KEY = "FFSBAmawo2m0d6LL-zpKh:cXNAGajBrMZTS4J8Mn99el0rXyFCAmwYkmwdNRj_j:bge-large-en-v1.5"
EMBEDDING_MODEL = "bge-large-en-v1.5"
EMBED_HF_MODEL = "BAAI/bge-large-en-v1.5"

# Processing configuration
TABLE_NAME = "items5"
MAX_TOKENS = 512
BUFFER_TOKENS = 10  # Safety buffer for tokenization differences

def make_db_request(endpoint, method="POST", body=None):
    """Helper function for database requests with consistent error handling."""
    headers = {
        "Authorization": f"Bearer {DB_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        if method == "POST":
            response = requests.post(f"{DB_BASE}{endpoint}", headers=headers, json=body, timeout=30)
        elif method == "DELETE":
            response = requests.delete(f"{DB_BASE}{endpoint}", headers=headers, json=body, timeout=30)
        else:
            response = requests.get(f"{DB_BASE}{endpoint}", headers=headers, params=body, timeout=30)
            
        return response
    except requests.exceptions.RequestException as e:
        print(f" Database request failed: {e}", file=sys.stderr)
        return None

def init_db():
    """Drop and recreate items5 table with vector index."""
    print(" Initializing database...")
    
    operations = [
        ("/drop-table", {"table_name": TABLE_NAME, "if_exists": True}),
        ("/create-table", {
            "table_name": TABLE_NAME,
            "columns": [
                {"name": "id", "type": "bigserial", "constraints": "PRIMARY KEY"},
                {"name": "data", "type": "json"},
                {"name": "embedding", "type": "vector(1024)"}
            ],
            "not_exists": True
        }),
        ("/create-vector-index", {
            "table_name": TABLE_NAME,
            "index_name": f"{TABLE_NAME}_embedding_index",
            "vector_column": "embedding",
            "index_type": "hnsw",
            "distance_operator": "vector_cosine_ops",
            "not_exists": True
        })
    ]
    
    for endpoint, body in operations:
        response = make_db_request(endpoint, body=body)
        if response:
            print(f" {endpoint} → {response.json()}")
        else:
            print(f" {endpoint} → Failed")
    
    print(" Database initialization complete.")

def clear_db():
    """Clear all data from the database table."""
    print(f" Clearing all data from {TABLE_NAME} table...")
    
    response = make_db_request(f"/{TABLE_NAME}", method="DELETE")
    if response and response.status_code in [200, 204]:
        result = response.json() if response.content else {"status": "cleared"}
        print(f" Table cleared successfully: {result}")
    else:
        error_msg = response.text if response else "Unknown error"
        print(f" Failed to clear table: {error_msg}")
        print(" Note: Table may not exist or may already be empty.")

def preprocess_text(text):
    """Remove hyphens at line breaks & collapse multiple spaces."""
    t = re.sub(r'-\s*\n', '', text)
    return re.sub(r' {2,}', ' ', t)

def estimate_tokens(text):
    """Rough token estimation (~4 characters per token for English)."""
    return len(text) // 4

def split_into_sentences(text):
    """Split text into sentences, handling common abbreviations."""
    # Basic sentence splitting - handles most common cases
    sentence_endings = re.compile(r'([.!?]+\s+)(?=[A-Z])')
    sentences = sentence_endings.split(text)
    
    result = []
    current = ""
    
    for i, part in enumerate(sentences):
        if re.match(r'^[.!?]+\s+$', part):
            # This is a sentence ending
            current += part
            result.append(current.strip())
            current = ""
        else:
            current += part
    
    # Add any remaining text
    if current.strip():
        result.append(current.strip())
    
    return [s for s in result if s.strip()]

def split_by_tokens(text, kind, max_tokens=MAX_TOKENS):
    """
    Split text into chunks that don't exceed max_tokens, preserving sentence boundaries.
    Returns list of (kind, text_chunk) tuples.
    """
    chunks = []
    
    # If the entire text is under the limit, return as-is
    if estimate_tokens(text) <= max_tokens - BUFFER_TOKENS:
        return [(kind, text)]
    
    # For headers and bullets, try to keep them as single units if possible
    if kind in ["header", "bullet"]:
        if estimate_tokens(text) <= max_tokens - BUFFER_TOKENS:
            return [(kind, text)]
        else:
            # If even a header/bullet is too long, we'll have to split it
            # Fall through to sentence-based splitting
            pass
    
    # Split into sentences for more granular control
    sentences = split_into_sentences(text)
    
    current_chunk = ""
    current_tokens = 0
    
    for sentence in sentences:
        sentence_tokens = estimate_tokens(sentence)
        
        # If a single sentence is too long, we need to split it further
        if sentence_tokens > max_tokens - BUFFER_TOKENS:
            # If we have content in current_chunk, save it first
            if current_chunk.strip():
                chunks.append((kind, current_chunk.strip()))
                current_chunk = ""
                current_tokens = 0
            
            # Split the long sentence by words
            words = sentence.split()
            word_chunk = []
            word_tokens = 0
            
            for word in words:
                word_token_estimate = estimate_tokens(word + " ")
                
                if word_tokens + word_token_estimate > max_tokens - BUFFER_TOKENS:
                    if word_chunk:
                        chunks.append((kind, " ".join(word_chunk)))
                    word_chunk = [word]
                    word_tokens = word_token_estimate
                else:
                    word_chunk.append(word)
                    word_tokens += word_token_estimate
            
            # Add any remaining words
            if word_chunk:
                chunks.append((kind, " ".join(word_chunk)))
            
        else:
            # Check if adding this sentence would exceed the limit
            if current_tokens + sentence_tokens > max_tokens - BUFFER_TOKENS:
                # Save current chunk and start a new one
                if current_chunk.strip():
                    chunks.append((kind, current_chunk.strip()))
                current_chunk = sentence
                current_tokens = sentence_tokens
            else:
                # Add sentence to current chunk
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
                current_tokens += sentence_tokens
    
    # Add any remaining content
    if current_chunk.strip():
        chunks.append((kind, current_chunk.strip()))
    
    return chunks

def fallback_chunk_by_tokens(text, max_tokens=MAX_TOKENS):
    """
    Fallback chunking when no structured groups are detected.
    Splits text into chunks of roughly max_tokens, preserving sentence boundaries.
    Returns list of (kind, text_chunk) tuples.
    """
    print(" No structured content detected (headers/bullets). Using fallback token-based chunking...")
    
    chunks = []
    sentences = split_into_sentences(text)
    
    current_chunk = ""
    current_tokens = 0
    chunk_num = 1
    
    for sentence in sentences:
        sentence_tokens = estimate_tokens(sentence)
        
        # If a single sentence is too long, split it by words
        if sentence_tokens > max_tokens - BUFFER_TOKENS:
            # Save current chunk if it has content
            if current_chunk.strip():
                chunks.append(("paragraph", current_chunk.strip()))
                chunk_num += 1
                current_chunk = ""
                current_tokens = 0
            
            # Split the long sentence by words
            words = sentence.split()
            word_chunk = []
            word_tokens = 0
            
            for word in words:
                word_token_estimate = estimate_tokens(word + " ")
                
                if word_tokens + word_token_estimate > max_tokens - BUFFER_TOKENS:
                    if word_chunk:
                        chunks.append(("paragraph", " ".join(word_chunk)))
                        chunk_num += 1
                    word_chunk = [word]
                    word_tokens = word_token_estimate
                else:
                    word_chunk.append(word)
                    word_tokens += word_token_estimate
            
            # Start new chunk with remaining words
            if word_chunk:
                current_chunk = " ".join(word_chunk)
                current_tokens = word_tokens
            
        else:
            # Check if adding this sentence would exceed the limit
            if current_tokens + sentence_tokens > max_tokens - BUFFER_TOKENS:
                # Save current chunk and start a new one
                chunks.append(("paragraph", current_chunk.strip()))
                chunk_num += 1
                current_chunk = sentence
                current_tokens = sentence_tokens
            else:
                # Add sentence to current chunk
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
                current_tokens += sentence_tokens
    
    # Add any remaining content
    if current_chunk.strip():
        chunks.append(("paragraph", current_chunk.strip()))
    
    return chunks

def split_groups(text):
    """
    Split text into ordered groups and then split large groups by token limits.
    Returns list of (kind, text) tuples where each text is under token limit.
    If no structured content is detected, falls back to token-based chunking.
    """
    heading = re.compile(r'^[A-Z0-9][A-Z0-9 ()/&-]+:$')
    bullet  = re.compile(r'^\s*[\u2022\-\*o]\s+')

    initial_groups, kind, buf = [], None, []
    
    # First pass: group by type (header/bullet/paragraph)
    for ln in text.splitlines():
        raw = ln.strip()
        if not raw:
            continue

        if heading.match(raw):
            if buf:
                initial_groups.append((kind, " ".join(buf)))
            kind, buf = "header", [raw]

        elif bullet.match(raw):
            if buf:
                initial_groups.append((kind, " ".join(buf)))
            kind, buf = "bullet", [raw]

        else:
            # continuation or new paragraph
            if kind and buf:
                buf.append(raw)
            else:
                if buf:
                    initial_groups.append((kind, " ".join(buf)))
                kind, buf = "paragraph", [raw]

    if buf:
        initial_groups.append((kind, " ".join(buf)))
    
    # Check if we detected any structured content (headers or bullets)
    has_structure = any(group_kind in ["header", "bullet"] for group_kind, _ in initial_groups)
    
    # If we only have one large paragraph and no structured content, use fallback chunking
    if (len(initial_groups) == 1 and 
        initial_groups[0][0] == "paragraph" and 
        not has_structure):
        
        # Check if this single paragraph is very large
        single_text = initial_groups[0][1]
        if estimate_tokens(single_text) > MAX_TOKENS:
            return fallback_chunk_by_tokens(single_text)
    
    # If we have very few groups and no clear structure, also consider fallback
    if (len(initial_groups) <= 2 and 
        not has_structure and 
        sum(estimate_tokens(text) for _, text in initial_groups) > MAX_TOKENS * 2):
        
        # Combine all text and use fallback chunking
        combined_text = " ".join(text for _, text in initial_groups)
        return fallback_chunk_by_tokens(combined_text)
    
    # Second pass: split groups that exceed token limits (normal processing)
    final_groups = []
    for group_kind, group_text in initial_groups:
        token_split_groups = split_by_tokens(group_text, group_kind)
        final_groups.extend(token_split_groups)
    
    return final_groups

def extract_pdf_pages(reader, start_page, end_page=None):
    """Extract text from specified PDF page range."""
    pages = []
    total_pages = len(reader.pages)
    
    # If end_page is None, extract to the end of the document
    if end_page is None:
        end_page = total_pages
    
    # Ensure we don't go beyond the document
    end_page = min(end_page, total_pages)
    
    print(f" Extracting pages {start_page + 1} to {end_page} (total pages: {total_pages})")
    
    for i in range(start_page, end_page):
        try:
            page_text = reader.pages[i].extract_text() or ""
            pages.append(page_text)
        except IndexError:
            print(f"  Page {i+1} not found, stopping extraction")
            break
        except Exception as e:
            print(f"  Failed to extract page {i+1}: {e}")
    
    return pages

def parse_pdf_with_range(path, page_range=None):
    """Parse PDF with custom page range and display content groups."""
    print(f" Parsing PDF: {path}")
    
    try:
        reader = PdfReader(path)
    except Exception as e:
        print(f" Failed to read PDF: {e}", file=sys.stderr)
        return
    
    # Handle page range
    if page_range:
        start_page, end_page = page_range
    else:
        start_page, end_page = 0, None  # Default: entire document
    
    pages = extract_pdf_pages(reader, start_page, end_page)
    if not pages:
        print(" No pages extracted from PDF", file=sys.stderr)
        return

    content = preprocess_text("\n".join(pages))
    groups = split_groups(content)
    
    print(f" Found {len(groups)} content groups after token-aware splitting:\n")
    
    for i, (kind, txt) in enumerate(groups, 1):
        tokens = estimate_tokens(txt)
        print(f"Group {i} - {kind.upper()} ({tokens} estimated tokens)")
        print(f"{txt}\n")
        print("-" * 80)

def parse_pdf(path):
    """Print out each group from the PDF without embedding (legacy function)."""
    # Default to hardcoded range for backward compatibility
    DEFAULT_RANGE = (5, 13)  # Original hardcoded range
    parse_pdf_with_range(path, DEFAULT_RANGE)

def get_embedding(text):
    """Get embedding for a single text."""
    try:
        emb_resp = requests.post(
            f"{LLM_BASE}/{EMBEDDING_MODEL}/v1/embeddings",
            headers={
                "Authorization": f"Bearer {EMBED_KEY}",
                "Content-Type": "application/json"
            },
            json={"model": EMBED_HF_MODEL, "input": [text]},
            timeout=30
        )
        
        if emb_resp.status_code != 200:
            print(f" Embedding API error: {emb_resp.status_code}", file=sys.stderr)
            print(f"Response: {emb_resp.text}", file=sys.stderr)
            return None
            
        emb_json = emb_resp.json()
        if "data" not in emb_json or not emb_json["data"]:
            print(f" Invalid embedding response: {emb_json}", file=sys.stderr)
            return None
            
        return emb_json["data"][0]["embedding"]
        
    except requests.exceptions.RequestException as e:
        print(f" Embedding request failed: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f" Embedding error: {e}", file=sys.stderr)
        return None

def ingest_with_page_range(path, page_range=None):
    """Parse PDF with custom page range, split into token-limited groups, embed, and store in database."""
    print(f" Reading PDF: {path}")
    
    try:
        reader = PdfReader(path)
    except Exception as e:
        print(f" Failed to read PDF: {e}", file=sys.stderr)
        return
    
    # Handle page range
    if page_range:
        start_page, end_page = page_range
    else:
        start_page, end_page = 0, None  # Default: entire document
        
    pages = extract_pdf_pages(reader, start_page, end_page)
    if not pages:
        print(" No pages extracted from PDF", file=sys.stderr)
        return

    # Process content into token-aware groups
    content = preprocess_text("\n".join(pages))
    groups = split_groups(content)
    
    if not groups:
        print(" No content groups found in PDF", file=sys.stderr)
        return

    print(f" Found {len(groups)} content groups (after token-aware splitting)")
    successful_ingestions = 0

    for idx, (kind, group_text) in enumerate(groups, start=1):
        tokens = estimate_tokens(group_text)
        print(f" Ingesting {kind} #{idx} ({tokens} tokens): {group_text[:80]}{'…' if len(group_text)>80 else ''}")
        
        # Warn if still over limit (shouldn't happen with proper splitting)
        if tokens > MAX_TOKENS - BUFFER_TOKENS:
            print(f" WARNING: Group #{idx} still exceeds token limit ({tokens} tokens)")

        # Get embedding and store in database
        embedding = get_embedding(group_text)
        if embedding is None:
            print(f" Skipping group #{idx} due to embedding failure")
            continue

        record = {
            "data": {
                "kind": kind, 
                "text": group_text, 
                "group_id": idx,
                "estimated_tokens": tokens
            },
            "embedding": embedding
        }
        
        response = make_db_request(f"/{TABLE_NAME}", body=record)
        if response and response.status_code in [200, 201]:
            print(f" Group #{idx} inserted successfully")
            successful_ingestions += 1
        else:
            error_msg = response.text if response else "Request failed"
            print(f" DB insertion failed for group #{idx}: {error_msg}")

    print(f" Ingestion complete: {successful_ingestions}/{len(groups)} groups successfully ingested")

def ingest(path):
    """Parse PDF, split into token-limited groups, embed, and store in database (legacy function)."""
    # Default to hardcoded range for backward compatibility
    DEFAULT_RANGE = (5, 13)  # Original hardcoded range
    ingest_with_page_range(path, DEFAULT_RANGE)

def chat():
    """Interactive chat with RAG using embedded PDF content."""
    print(" Enhanced RAG Chat Mode - Combines general knowledge with ingested PDF content")
    print("Type 'quit' or 'exit' to end the session\n")
    
    while True:
        try:
            q = input(" Question: ").strip()
            if not q or q.lower() in ['quit', 'exit']:
                print(" Goodbye!")
                break
                
            # 1) Get embedding for the question
            print("🔍 Searching for relevant content...")
            question_embedding = get_embedding(q)
            if question_embedding is None:
                print(" Failed to embed question, continuing with general knowledge only...")
                # Still provide a response using general knowledge
                messages = [
                    {"role": "system", "content": "You are a helpful assistant. Answer the user's question using your general knowledge. Note that you were unable to search the document database, so your response is based only on general knowledge."},
                    {"role": "user", "content": q}
                ]
            else:
                # Search for relevant content in database
                try:
                    params = {
                        "query_vector": json.dumps(question_embedding),
                        "vector_column": "embedding", 
                        "distance_operator": "<=>",
                        "limit": 5
                    }
                    
                    search_resp = requests.get(
                        f"{DB_BASE}/{TABLE_NAME}",
                        headers={"Authorization": f"Bearer {DB_KEY}"},
                        params=params,
                        timeout=30
                    )
                    
                    if search_resp.status_code != 200:
                        print(f" Search failed: {search_resp.status_code}, using general knowledge only")
                        hits = []
                    else:
                        hits = search_resp.json()
                        
                except Exception as e:
                    print(f" Search error: {e}, using general knowledge only")
                    hits = []

                # Build context from retrieved groups
                context_parts = []
                if hits:
                    for i, hit in enumerate(hits, 1):
                        if "data" in hit and "text" in hit["data"]:
                            kind = hit["data"].get("kind", "unknown")
                            text = hit["data"]["text"]
                            context_parts.append(f"[{kind.upper()} {i}]\n{text}")
                            
                if context_parts:
                    context = "\n\n".join(context_parts)
                    print(f" Found {len(context_parts)} relevant content pieces from the document")
                    
                    # Enhanced prompt combining document context with general knowledge
                    messages = [
                        {"role": "system", "content": """You are a helpful and knowledgeable assistant. You have access to both your general knowledge and specific content from a document that has been provided as context.

Instructions:
1. First, use the document context to answer the question if it contains relevant information
2. Supplement your answer with your general knowledge to provide a comprehensive response
3. If the document context contains specific details, data, or procedures related to the question, prioritize and highlight this information
4. If the document context doesn't fully answer the question, use your general knowledge to fill in gaps and provide additional helpful information
5. Clearly distinguish between information from the document and your general knowledge when appropriate
6. Always aim to give the most accurate and complete answer possible

The document context provided may be incomplete, so feel free to expand on the topic using your broader knowledge while staying accurate to any specific details in the document."""},
                        {"role": "user", "content": f"""Document context (relevant excerpts):
{context}

Question: {q}

Please provide a comprehensive answer using both the document context above (if relevant) and your general knowledge."""}
                    ]
                else:
                    print("  No relevant content found in the document database")
                    # Fallback to general knowledge with note about document search
                    messages = [
                        {"role": "system", "content": "You are a helpful assistant. The user has a document database, but no relevant content was found for this question. Answer using your general knowledge and mention that you searched the document but didn't find specific relevant content."},
                        {"role": "user", "content": f"Question: {q}\n\nNote: I searched my document database but didn't find specific content related to this question. Please answer using general knowledge."}
                    ]
            
            # Generate comprehensive answer using LLM
            try:
                llm_resp = requests.post(
                    f"{LLM_BASE}/llama3.1-8b-instruct/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {LLM_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "meta-llama/Meta-Llama-3-8B-Instruct",
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 800  # Increased for comprehensive responses
                    },
                    timeout=60
                )
                
                if llm_resp.status_code != 200:
                    print(f" LLM request failed: {llm_resp.status_code}")
                    print(f"Response: {llm_resp.text}")
                    continue
                    
                llm_result = llm_resp.json()
                if "choices" not in llm_result or not llm_result["choices"]:
                    print(" Invalid LLM response format")
                    continue
                    
                answer = llm_result["choices"][0]["message"]["content"]
                print("\n Enhanced Answer:")
                print("=" * 60)
                print(answer)
                print("=" * 60)
                
                # Show what sources were used
                if context_parts:
                    print(f"\n This answer was enhanced using {len(context_parts)} relevant sections from your document.")
                else:
                    print(f"\n This answer is based on general knowledge (no specific document content was found for this question).")
                print()
                
            except requests.exceptions.RequestException as e:
                print(f" LLM request failed: {e}")
                continue
            except Exception as e:
                print(f" LLM processing error: {e}")
                continue
                
        except KeyboardInterrupt:
            print("\n Goodbye!")
            break
        except Exception as e:
            print(f" Unexpected error: {e}")
            continue

def main():
    """Main entry point for CLI commands."""
    args = docopt(__doc__)
    
    if args.get("init-db"):
        init_db()
    elif args.get("clear-db"):
        clear_db()
    elif args.get("ingest"):
        # Parse page range arguments
        start_page = int(args.get("--start-page", 1)) - 1  # Convert to 0-indexed
        end_page_str = args.get("--end-page")
        end_page = int(end_page_str) if end_page_str else None
        
        page_range = (start_page, end_page)
        ingest_with_page_range(args["<file_path>"], page_range)
    elif args.get("parse"):
        # Parse page range arguments
        start_page = int(args.get("--start-page", 1)) - 1  # Convert to 0-indexed
        end_page_str = args.get("--end-page")
        end_page = int(end_page_str) if end_page_str else None
        
        page_range = (start_page, end_page)
        parse_pdf_with_range(args["<file_path>"], page_range)
    elif args.get("chat"):
        chat()

if __name__ == "__main__":
    main()