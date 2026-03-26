#!/usr/bin/env python3
"""
FIXED: Flask PDF-Chat RAG API Server
Fixes common startup and endpoint issues
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import tempfile
import json
from werkzeug.utils import secure_filename
import sys
import requests
import traceback
from datetime import datetime
import numpy as np

# Import your existing CLI functions
try:
    from cli import get_embedding, make_db_request, DB_BASE, DB_KEY, LLM_BASE, LLM_KEY, TABLE_NAME
    print("✅ Successfully imported CLI functions")
except ImportError as e:
    print(f" Error importing CLI functions: {e}")
    print("Make sure cli.py is in the same directory as app.py")
    print("Current directory:", os.getcwd())
    print("Files in current directory:", os.listdir('.'))
    sys.exit(1)

# Create Flask app
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000", "*"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Configure upload settings
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Use same table names as working CLI
PDFS_TABLE = "pdfs"
PDF_MESSAGES_TABLE = "pdf_messages"  # Direct PDF to messages
CONTENT_TABLE = "items5"  # Use same table name as CLI

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors"""
    try:
        # Convert to numpy arrays
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        # Calculate cosine similarity
        dot_product = np.dot(v1, v2)
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        
        if norm_v1 == 0 or norm_v2 == 0:
            return 0
            
        similarity = dot_product / (norm_v1 * norm_v2)
        return float(similarity)
    except Exception as e:
        print(f"Error calculating cosine similarity: {e}")
        return 0

def manual_vector_search(question_embedding, pdf_id, limit=5):
    """Manual vector search implementation with detailed debugging"""
    try:
        print(f" Performing manual vector search for PDF {pdf_id}")
        
        # Get all content from the database
        content_response = make_db_request(f"/{CONTENT_TABLE}", method="GET")
        
        if not content_response or content_response.status_code != 200:
            error_msg = f"Failed to fetch content: {content_response.status_code if content_response else 'No response'}"
            print(f" {error_msg}")
            return []
        
        all_content = content_response.json()
        print(f" Total content items in database: {len(all_content)}")
        
        # Enhanced filtering - try multiple approaches to find PDF content
        pdf_content = []
        
        # Method 1: Check pdf_id in data object (most likely location based on ingestion code)
        method1_matches = []
        for item in all_content:
            if ('data' in item and 
                isinstance(item['data'], dict) and 
                item['data'].get('pdf_id') == pdf_id):
                method1_matches.append(item)
        
        # Method 2: Check direct pdf_id field
        method2_matches = []
        for item in all_content:
            if item.get('pdf_id') == pdf_id:
                method2_matches.append(item)
        
        # Method 3: String comparison (in case of type mismatches)
        method3_matches = []
        for item in all_content:
            # Check if pdf_id stored as string
            if ('data' in item and 
                isinstance(item['data'], dict) and 
                str(item['data'].get('pdf_id')) == str(pdf_id)):
                method3_matches.append(item)
        
        print(f" Method 1 (data.pdf_id == {pdf_id}): {len(method1_matches)} matches")
        print(f" Method 2 (direct pdf_id == {pdf_id}): {len(method2_matches)} matches")  
        print(f" Method 3 (string match): {len(method3_matches)} matches")
        
        # Use the method that found results, prefer method 1
        if method1_matches:
            pdf_content = method1_matches
            print(f" Using Method 1 results: {len(pdf_content)} items")
        elif method2_matches:
            pdf_content = method2_matches
            print(f" Using Method 2 results: {len(pdf_content)} items")
        elif method3_matches:
            pdf_content = method3_matches
            print(f"Using Method 3 results: {len(pdf_content)} items")
        else:
            print(f" No content found for PDF {pdf_id}")
            return []
        
        # Calculate similarities for each content item
        similarities = []
        
        for item in pdf_content:
            if 'embedding' not in item or not item['embedding']:
                print(f" Item {item.get('id', 'unknown')} has no embedding")
                continue
            
            try:
                item_embedding = item['embedding']
                similarity = cosine_similarity(question_embedding, item_embedding)
                
                # Get text preview for debugging
                text_preview = ""
                if isinstance(item.get('data'), dict) and 'text' in item['data']:
                    text_preview = item['data']['text'][:100]
                
                similarities.append({
                    'item': item,
                    'similarity': similarity,
                    'id': item.get('id'),
                    'text_preview': text_preview,
                    'kind': item.get('data', {}).get('kind', 'unknown') if isinstance(item.get('data'), dict) else 'unknown'
                })
                
            except Exception as e:
                print(f" Error calculating similarity for item {item.get('id')}: {e}")
                continue
        
        print(f" Calculated similarities for {len(similarities)} items")
        
        if not similarities:
            print(" No items with valid embeddings found")
            return []
        
        # Sort by similarity (highest first)
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        
        # Show top similarities for debugging
        print(" Top similarities:")
        for i, sim_item in enumerate(similarities[:limit]):
            print(f"  {i+1}. Similarity: {sim_item['similarity']:.4f} | {sim_item['kind']} | Text: {sim_item['text_preview']}...")
        
        # Return top items
        top_items = [sim_item['item'] for sim_item in similarities[:limit]]
        
        print(f"Returning {len(top_items)} most relevant items")
        return top_items
        
    except Exception as e:
        print(f" Manual vector search failed: {e}")
        traceback.print_exc()
        return []

def init_direct_pdf_chat_db():
    """Initialize simplified database schema matching CLI structure"""
    print(" Initializing direct PDF-chat database schema...")
    
    # Use same operations as CLI's init_db() but add our additional tables
    operations = [
        # First, recreate the content table exactly like CLI does
        ("/drop-table", {"table_name": CONTENT_TABLE, "if_exists": True}),
        ("/create-table", {
            "table_name": CONTENT_TABLE,
            "columns": [
                {"name": "id", "type": "bigserial", "constraints": "PRIMARY KEY"},
                {"name": "data", "type": "json"},
                {"name": "embedding", "type": "vector(1024)"}
            ],
            "not_exists": True
        }),
        ("/create-vector-index", {
            "table_name": CONTENT_TABLE,
            "index_name": f"{CONTENT_TABLE}_embedding_index",
            "vector_column": "embedding",
            "index_type": "hnsw",
            "distance_operator": "vector_cosine_ops",
            "not_exists": True
        }),
        
        # Then add our additional tables
        ("/drop-table", {"table_name": PDF_MESSAGES_TABLE, "if_exists": True}),
        ("/drop-table", {"table_name": PDFS_TABLE, "if_exists": True}),
        
        ("/create-table", {
            "table_name": PDFS_TABLE,
            "columns": [
                {"name": "id", "type": "bigserial", "constraints": "PRIMARY KEY"},
                {"name": "filename", "type": "varchar(255)", "constraints": "NOT NULL"},
                {"name": "original_name", "type": "varchar(255)", "constraints": "NOT NULL"},
                {"name": "upload_date", "type": "timestamp", "constraints": "DEFAULT NOW()"},
                {"name": "page_range_start", "type": "integer"},
                {"name": "page_range_end", "type": "integer"},
                {"name": "chunk_count", "type": "integer", "constraints": "DEFAULT 0"},
                {"name": "chat_active", "type": "boolean", "constraints": "DEFAULT true"},
                {"name": "last_chat_at", "type": "timestamp"}
            ],
            "not_exists": True
        }),
        
        ("/create-table", {
            "table_name": PDF_MESSAGES_TABLE,
            "columns": [
                {"name": "id", "type": "bigserial", "constraints": "PRIMARY KEY"},
                {"name": "pdf_id", "type": "bigint"},
                {"name": "message_type", "type": "varchar(20)", "constraints": "CHECK (message_type IN ('user', 'assistant'))"},
                {"name": "content", "type": "text", "constraints": "NOT NULL"},
                {"name": "timestamp", "type": "timestamp", "constraints": "DEFAULT NOW()"},
                {"name": "sources_used", "type": "integer", "constraints": "DEFAULT 0"},
                {"name": "context_used", "type": "boolean", "constraints": "DEFAULT false"}
            ],
            "not_exists": True
        })
    ]
    
    success_count = 0
    for endpoint, body in operations:
        print(f"   Executing: {endpoint} for {body.get('table_name', 'index')}")
        response = make_db_request(endpoint, body=body)
        if response:
            try:
                result = response.json()
                print(f"     ✓ Success: {result}")
                success_count += 1
            except:
                print(f"     ✓ Success: {response.status_code}")
                success_count += 1
        else:
            print(f"     ✗ Failed: No response")
    
    print(f" Database initialization complete: {success_count}/{len(operations)} operations successful")
    return success_count == len(operations)

def ingest_pdf_with_id(filepath, pdf_id, page_range=None):
    """Modified ingest function that associates content with a PDF ID"""
    from PyPDF2 import PdfReader
    import re
    
    try:
        reader = PdfReader(filepath)
    except Exception as e:
        print(f"Failed to read PDF: {e}")
        raise
    
    # Handle page range
    if page_range:
        start_page, end_page = page_range
    else:
        start_page, end_page = 0, None
    
    # Extract pages
    pages = []
    total_pages = len(reader.pages)
    
    if end_page is None:
        end_page = total_pages
    
    end_page = min(end_page, total_pages)
    
    print(f"Extracting pages {start_page + 1} to {end_page} (total pages: {total_pages})")
    
    for i in range(start_page, end_page):
        try:
            page_text = reader.pages[i].extract_text() or ""
            pages.append(page_text)
        except IndexError:
            print(f"Page {i+1} not found, stopping extraction")
            break
        except Exception as e:
            print(f"Failed to extract page {i+1}: {e}")
    
    if not pages:
        raise Exception("No pages extracted from PDF")

    # Process content
    def preprocess_text(text):
        t = re.sub(r'-\s*\n', '', text)
        return re.sub(r' {2,}', ' ', t)
    
    content = preprocess_text("\n".join(pages))
    
    # Import split_groups function from cli.py
    from cli import split_groups
    groups = split_groups(content)
    
    if not groups:
        raise Exception("No content groups found in PDF")

    print(f"Found {len(groups)} content groups")
    successful_ingestions = 0

    for idx, (kind, group_text) in enumerate(groups, start=1):
        print(f"Ingesting {kind} #{idx}: {group_text[:80]}{'…' if len(group_text)>80 else ''}")
        
        # Get embedding
        embedding = get_embedding(group_text)
        if embedding is None:
            print(f"Skipping group #{idx} due to embedding failure")
            continue

        record = {
            "data": {
                "kind": kind, 
                "text": group_text, 
                "group_id": idx,
                "estimated_tokens": len(group_text) // 4,
                "pdf_id": pdf_id,  # Store PDF ID in data object like CLI pattern
                "chunk_index": idx
            },
            "embedding": embedding
        }
        
        response = make_db_request(f"/{CONTENT_TABLE}", body=record)
        if response and response.status_code in [200, 201]:
            print(f"Group #{idx} inserted successfully")
            successful_ingestions += 1
        else:
            error_msg = response.text if response else "Request failed"
            print(f"DB insertion failed for group #{idx}: {error_msg}")

    print(f"Ingestion complete: {successful_ingestions}/{len(groups)} groups successfully ingested")
    return successful_ingestions

# ==================== ROUTES ====================

# Root route for testing
@app.route('/', methods=['GET'])
def root():
    """Root endpoint to verify server is running"""
    return jsonify({
        "status": "running",
        "message": "PDF-Chat RAG API Server is running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "database": "/api/database-status",
            "init_db": "/api/init-db",
            "clear_db": "/api/clear-db",
            "upload": "/api/upload-pdf",
            "list_pdfs": "/api/pdfs",
            "chat": "/api/chat/<pdf_id>"
        }
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy", 
        "message": "Direct PDF-Chat API is running",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/init-db', methods=['POST'])
def api_init_db():
    """Initialize database with direct PDF-chat support"""
    try:
        print("🔧 Initializing direct PDF-chat database...")
        success = init_direct_pdf_chat_db()
        if success:
            return jsonify({"success": True, "message": "Direct PDF-chat database initialized successfully"})
        else:
            return jsonify({"success": False, "error": "Some database operations failed"}), 500
    except Exception as e:
        print(f"Database initialization error: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clear-db', methods=['POST'])
def api_clear_db():
    """Clear all database tables"""
    try:
        print(" Clearing all database tables...")
        
        # Clear in reverse order due to foreign key constraints
        tables_to_clear = [PDF_MESSAGES_TABLE, CONTENT_TABLE, PDFS_TABLE]
        
        for table in tables_to_clear:
            response = make_db_request(f"/{table}", method="DELETE")
            if response and response.status_code in [200, 204]:
                print(f"   ✓ Cleared {table}")
            else:
                print(f"   ✗ Failed to clear {table}")
        
        return jsonify({"success": True, "message": "All database tables cleared successfully"})
    except Exception as e:
        print(f"Database clear error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/pdfs', methods=['GET'])
def list_pdfs():
    """Get list of all uploaded PDFs with message counts"""
    try:
        # Get PDFs
        pdf_response = make_db_request(f"/{PDFS_TABLE}", method="GET")
        
        if not pdf_response or pdf_response.status_code != 200:
            return jsonify({
                "success": False,
                "error": "Failed to fetch PDFs",
                "pdfs": []
            })
            
        pdfs = pdf_response.json()
        
        # Get message counts for each PDF
        messages_response = make_db_request(f"/{PDF_MESSAGES_TABLE}", method="GET")
        message_counts = {}
        
        if messages_response and messages_response.status_code == 200:
            messages = messages_response.json()
            for message in messages:
                pdf_id = message.get('pdf_id')
                if pdf_id:
                    message_counts[pdf_id] = message_counts.get(pdf_id, 0) + 1
        
        # Add message counts to PDFs
        for pdf in pdfs:
            pdf['message_count'] = message_counts.get(pdf['id'], 0)
            pdf['has_chat_history'] = message_counts.get(pdf['id'], 0) > 0
        
        return jsonify({
            "success": True,
            "pdfs": pdfs
        })
            
    except Exception as e:
        print(f"List PDFs error: {e}")
        return jsonify({"success": False, "error": str(e), "pdfs": []}), 500

@app.route('/api/pdfs/<int:pdf_id>', methods=['DELETE'])
def delete_pdf(pdf_id):
    """Delete a PDF and all associated data"""
    try:
        response = make_db_request(f"/{PDFS_TABLE}", method="DELETE", body={"id": pdf_id})
        
        if response and response.status_code in [200, 204]:
            return jsonify({
                "success": True,
                "message": "PDF and all associated data deleted successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to delete PDF"
            }), 500
            
    except Exception as e:
        print(f"Delete PDF error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/upload-pdf', methods=['POST'])
def upload_pdf_direct():
    """Upload and process PDF file - chat ready immediately"""
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"success": False, "error": "Invalid file type. Only PDF files are allowed"}), 400
        
        # Get page range parameters
        start_page = request.form.get('startPage', '1')
        end_page = request.form.get('endPage', '')
        
        # Validate page range
        try:
            start_page_num = int(start_page)
            if start_page_num < 1:
                return jsonify({"success": False, "error": "Start page must be greater than 0"}), 400
            
            end_page_num = None
            if end_page:
                end_page_num = int(end_page)
                if end_page_num < start_page_num:
                    return jsonify({"success": False, "error": "End page must be greater than or equal to start page"}), 400
        except ValueError:
            return jsonify({"success": False, "error": "Page numbers must be valid integers"}), 400
        
        # Save the uploaded file
        filename = secure_filename(file.filename)
        original_name = file.filename
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        try:
            file.save(filepath)
            print(f"File saved to: {filepath}")
        except Exception as e:
            return jsonify({"success": False, "error": f"Failed to save file: {str(e)}"}), 500
        
        # Create PDF record in database
        try:
            pdf_record = {
                "filename": filename,
                "original_name": original_name,
                "page_range_start": start_page_num,
                "page_range_end": end_page_num,
                "chunk_count": 0,
                "chat_active": True
            }
            
            print(f"Creating PDF record: {pdf_record}")
            pdf_response = make_db_request(f"/{PDFS_TABLE}", body=pdf_record)
            
            if not pdf_response or pdf_response.status_code not in [200, 201]:
                error_text = pdf_response.text if pdf_response else "No response"
                raise Exception(f"Failed to create PDF record: {error_text}")
            
            # Parse the response to get PDF ID
            pdf_data = pdf_response.json()
            print(f"PDF creation response: {pdf_data}")
            
            pdf_id = None
            if isinstance(pdf_data, dict):
                pdf_id = pdf_data.get('id')
            elif isinstance(pdf_data, list) and len(pdf_data) > 0:
                pdf_id = pdf_data[0].get('id')
            
            if not pdf_id:
                raise Exception(f"Failed to get PDF ID from response: {pdf_data}")
                
        except Exception as e:
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except:
                pass
            return jsonify({"success": False, "error": f"Failed to create PDF record: {str(e)}"}), 500
        
        # Process the PDF
        try:
            print(f"Processing PDF: {filename}")
            print(f"Page range: {start_page_num} to {end_page_num if end_page_num else 'end'}")
            
            # Convert to 0-indexed for internal processing
            page_range = (start_page_num - 1, end_page_num if end_page_num else None)
            chunk_count = ingest_pdf_with_id(filepath, pdf_id, page_range)
            
            # Update chunk count in PDF record
            update_response = make_db_request(f"/{PDFS_TABLE}", body={
                "id": pdf_id,
                "chunk_count": chunk_count
            })
            
            # Clean up the temporary file
            try:
                os.remove(filepath)
            except Exception as e:
                print(f"Warning: Could not remove temporary file: {e}")
            
            return jsonify({
                "success": True, 
                "message": f"PDF processed successfully! Chat is now ready.",
                "filename": original_name,
                "pdf_id": pdf_id,
                "chunk_count": chunk_count,
                "chat_ready": True,
                "page_range": f"{start_page} to {end_page if end_page else 'end'}"
            })
            
        except Exception as e:
            # Clean up the temporary file and PDF record on error
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                make_db_request(f"/{PDFS_TABLE}", method="DELETE", body={"id": pdf_id})
            except:
                pass
            
            print(f"PDF processing error: {e}")
            traceback.print_exc()
            return jsonify({
                "success": False, 
                "error": f"Failed to process PDF: {str(e)}"
            }), 500
            
    except Exception as e:
        print(f"Upload endpoint error: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/chat/<int:pdf_id>', methods=['POST'])
def api_chat_direct(pdf_id):
    """Chat directly with a PDF using improved vector search with debugging"""
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({"success": False, "error": "No message provided"}), 400
        
        question = data['message'].strip()
        if not question:
            return jsonify({"success": False, "error": "Empty message"}), 400
        
        # Verify PDF exists and get info
        pdf_response = make_db_request(f"/{PDFS_TABLE}", method="GET")
        if not pdf_response or pdf_response.status_code != 200:
            return jsonify({"success": False, "error": "Failed to access PDF database"}), 500
            
        pdfs = pdf_response.json()
        current_pdf = next((pdf for pdf in pdfs if pdf['id'] == pdf_id), None)
        if not current_pdf:
            return jsonify({"success": False, "error": "PDF not found"}), 404
        
        print(f" Processing chat question for PDF {pdf_id} ({current_pdf['original_name']}): {question[:50]}...")
        
        # Save user message
        user_message = {
            "pdf_id": pdf_id,
            "message_type": "user",
            "content": question
        }
        make_db_request(f"/{PDF_MESSAGES_TABLE}", body=user_message)
        
        # Get embedding for the question
        print(" Getting question embedding...")
        question_embedding = get_embedding(question)
        if question_embedding is None:
            print(" Failed to get embedding, using general knowledge")
            messages = [
                {"role": "system", "content": "You are a helpful assistant. Answer the user's question using your general knowledge. Note that you were unable to search the document database, so your response is based only on general knowledge."},
                {"role": "user", "content": question}
            ]
            context_used = False
            context_parts = []
        else:
            print(" Question embedding obtained successfully")
            
            # Try multiple approaches to find relevant content
            hits = []
            
            # Approach 1: Try the original vector search API (if it works)
            print(" Attempting API vector search...")
            try:
                params = {
                    "query_vector": json.dumps(question_embedding),
                    "vector_column": "embedding", 
                    "distance_operator": "<=>",
                    "limit": 5
                }
                
                search_resp = requests.get(
                    f"{DB_BASE}/{CONTENT_TABLE}",
                    headers={"Authorization": f"Bearer {DB_KEY}"},
                    params=params,
                    timeout=30
                )
                
                print(f" API Search Response: {search_resp.status_code}")
                
                if search_resp.status_code == 200:
                    api_hits = search_resp.json()
                    # Filter results to only include content from this PDF
                    api_hits_filtered = []
                    for hit in api_hits:
                        hit_pdf_id = None
                        if 'data' in hit and isinstance(hit['data'], dict):
                            hit_pdf_id = hit['data'].get('pdf_id')
                        elif 'pdf_id' in hit:
                            hit_pdf_id = hit['pdf_id']
                        
                        if hit_pdf_id == pdf_id:
                            api_hits_filtered.append(hit)
                    
                    if api_hits_filtered:
                        hits = api_hits_filtered
                        print(f"API vector search found {len(hits)} relevant matches for PDF {pdf_id}")
                    else:
                        print(f" API vector search returned {len(api_hits)} results but none for PDF {pdf_id}")
                else:
                    print(f" API vector search failed: {search_resp.status_code}")
                    
            except Exception as e:
                print(f" API vector search error: {e}")
            
            # Approach 2: If API search failed or returned no results, use manual search
            if not hits:
                print(" Falling back to manual vector search...")
                hits = manual_vector_search(question_embedding, pdf_id, limit=5)
            
            # Build context from retrieved groups
            context_parts = []
            if hits:
                print(f"📝 Processing {len(hits)} retrieved items...")
                for i, hit in enumerate(hits, 1):
                    if "data" in hit and "text" in hit["data"]:
                        kind = hit["data"].get("kind", "unknown")
                        text = hit["data"]["text"]
                        context_parts.append(f"[{kind.upper()} {i}]\n{text}")
                        print(f"  📄 Context {i}: {kind} - {text[:100]}...")
                        
            if context_parts:
                context = "\n\n".join(context_parts)
                context_used = True
                print(f" Using {len(context_parts)} relevant context pieces from the document")
                
                messages = [
                    {"role": "system", "content": f"""You are a helpful and knowledgeable assistant. You have access to both your general knowledge and specific content from the document "{current_pdf['original_name']}" that has been provided as context.

Instructions:
1. First, use the document context to answer the question if it contains relevant information
2. Supplement your answer with your general knowledge to provide a comprehensive response
3. If the document context contains specific details, data, or procedures related to the question, prioritize and highlight this information
4. If the document context doesn't fully answer the question, use your general knowledge to fill in gaps and provide additional helpful information
5. Clearly distinguish between information from the document and your general knowledge when appropriate
6. Always aim to give the most accurate and complete answer possible

The document context provided may be incomplete, so feel free to expand on the topic using your broader knowledge while staying accurate to any specific details in the document."""},
                    {"role": "user", "content": f"""Document context from "{current_pdf['original_name']}" (relevant excerpts):
{context}

Question: {question}

Please provide a comprehensive answer using both the document context above (if relevant) and your general knowledge."""}
                ]
            else:
                context_used = False
                print(" No relevant context found in the document, using general knowledge")
                messages = [
                    {"role": "system", "content": f"""You are a helpful assistant. The user has uploaded a document titled "{current_pdf['original_name']}", but no relevant content was found for this question. Answer using your general knowledge and mention that you searched the document but didn't find specific relevant content."""},
                    {"role": "user", "content": f"Question: {question}\n\nNote: I searched the document \"{current_pdf['original_name']}\" but didn't find specific content related to this question. Please answer using general knowledge."}
                ]
        
        # Generate answer using LLM
        print(" Generating response with LLM...")
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
                    "max_tokens": 800
                },
                timeout=60
            )
            
            if llm_resp.status_code != 200:
                print(f" LLM request failed: {llm_resp.status_code} - {llm_resp.text}")
                return jsonify({
                    "success": False, 
                    "error": f"LLM request failed: {llm_resp.status_code}"
                }), 500
                
            llm_result = llm_resp.json()
            if "choices" not in llm_result or not llm_result["choices"]:
                print(f"Invalid LLM response: {llm_result}")
                return jsonify({
                    "success": False, 
                    "error": "Invalid LLM response format"
                }), 500
                
            answer = llm_result["choices"][0]["message"]["content"]
            print(" Successfully generated response")
            
            # Save assistant message
            assistant_message = {
                "pdf_id": pdf_id,
                "message_type": "assistant",
                "content": answer,
                "sources_used": len(context_parts) if context_used else 0,
                "context_used": context_used
            }
            make_db_request(f"/{PDF_MESSAGES_TABLE}", body=assistant_message)
            
            # Update PDF last chat timestamp
            update_pdf = {
                "id": pdf_id,
                "last_chat_at": datetime.now().isoformat()
            }
            make_db_request(f"/{PDFS_TABLE}", body=update_pdf)
            
            return jsonify({
                "success": True,
                "response": answer,
                "context_used": context_used,
                "sources_count": len(context_parts) if context_used else 0,
                "pdf_name": current_pdf['original_name'],
                "debug_info": {
                    "question_embedding_obtained": question_embedding is not None,
                    "total_context_parts": len(context_parts),
                    "search_method": "manual" if not hits else "api"
                }
            })
            
        except requests.exceptions.RequestException as e:
            print(f" LLM request error: {e}")
            return jsonify({"success": False, "error": f"LLM request failed: {str(e)}"}), 500
        except Exception as e:
            print(f" LLM processing error: {e}")
            return jsonify({"success": False, "error": f"LLM processing error: {str(e)}"}), 500
            
    except Exception as e:
        print(f" Chat endpoint error: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/pdf/<int:pdf_id>/messages', methods=['GET'])
def get_pdf_chat_history(pdf_id):
    """Get all chat messages for a specific PDF"""
    try:
        # Get all messages and filter by PDF ID
        messages_response = make_db_request(f"/{PDF_MESSAGES_TABLE}", method="GET")
        
        if messages_response and messages_response.status_code == 200:
            all_messages = messages_response.json()
            pdf_messages = [
                msg for msg in all_messages 
                if msg.get('pdf_id') == pdf_id
            ]
            
            # Sort by timestamp
            pdf_messages.sort(key=lambda x: x.get('timestamp', ''))
            
            return jsonify({
                "success": True,
                "messages": pdf_messages,
                "message_count": len(pdf_messages)
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to fetch chat history",
                "messages": []
            })
            
    except Exception as e:
        print(f"Get PDF chat history error: {e}")
        return jsonify({"success": False, "error": str(e), "messages": []}), 500

@app.route('/api/pdf/<int:pdf_id>/clear-chat', methods=['POST'])
def clear_pdf_chat_history(pdf_id):
    """Clear all chat messages for a specific PDF"""
    try:
        # Get all messages
        messages_response = make_db_request(f"/{PDF_MESSAGES_TABLE}", method="GET")
        
        if messages_response and messages_response.status_code == 200:
            all_messages = messages_response.json()
            pdf_messages = [
                msg for msg in all_messages 
                if msg.get('pdf_id') == pdf_id
            ]
            
            # Delete each message
            deleted_count = 0
            for message in pdf_messages:
                delete_response = make_db_request(f"/{PDF_MESSAGES_TABLE}", method="DELETE", body={"id": message['id']})
                if delete_response and delete_response.status_code in [200, 204]:
                    deleted_count += 1
            
            return jsonify({
                "success": True,
                "message": f"Cleared {deleted_count} chat messages",
                "deleted_count": deleted_count
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to access chat messages"
            })
            
    except Exception as e:
        print(f"Clear PDF chat history error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/database-status', methods=['GET'])
def database_status():
    """Check database status for direct PDF-chat system"""
    try:
        # Check if PDFs table exists and has data
        response = requests.get(
            f"{DB_BASE}/{PDFS_TABLE}",
            headers={"Authorization": f"Bearer {DB_KEY}"},
            params={"limit": 1},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            has_data = len(data) > 0 if isinstance(data, list) else bool(data)
            
            if has_data:
                # Get count of PDFs
                count_response = requests.get(
                    f"{DB_BASE}/{PDFS_TABLE}",
                    headers={"Authorization": f"Bearer {DB_KEY}"},
                    timeout=30
                )
                
                if count_response.status_code == 200:
                    pdf_count = len(count_response.json())
                    message = f"Database ready with {pdf_count} PDF{'s' if pdf_count != 1 else ''} - chat ready!"
                else:
                    message = "Database ready with data - chat ready!"
            else:
                message = "Database is empty - upload a PDF to start chatting"
            
            return jsonify({
                "success": True,
                "has_data": has_data,
                "message": message,
                "system_type": "Direct PDF Chat (No Sessions)"
            })
        elif response.status_code == 404:
            return jsonify({
                "success": False,
                "has_data": False,
                "error": "Database tables do not exist",
                "message": "Click 'Initialize DB' to create the database tables"
            })
        else:
            return jsonify({
                "success": False,
                "has_data": False,
                "error": f"Database query failed: {response.status_code}",
                "message": "Database connection issue"
            })
            
    except requests.exceptions.RequestException as e:
        print(f"Database status check error: {e}")
        return jsonify({
            "success": False,
            "has_data": False,
            "error": f"Database connection failed: {str(e)}",
            "message": "Cannot connect to database"
        })
    except Exception as e:
        print(f"Database status error: {e}")
        return jsonify({
            "success": False,
            "has_data": False,
            "error": str(e)
        })

# Debug endpoints
@app.route('/api/debug/tables', methods=['GET'])
def debug_tables():
    """Debug endpoint to check what tables exist"""
    try:
        tables_status = {}
        tables_to_check = [PDFS_TABLE, PDF_MESSAGES_TABLE, CONTENT_TABLE]
        
        for table in tables_to_check:
            try:
                response = make_db_request(f"/{table}", method="GET", body={"limit": 1})
                if response and response.status_code == 200:
                    tables_status[table] = "EXISTS"
                elif response and response.status_code == 404:
                    tables_status[table] = "NOT_FOUND"
                else:
                    tables_status[table] = f"ERROR_{response.status_code if response else 'NO_RESPONSE'}"
            except Exception as e:
                tables_status[table] = f"EXCEPTION: {str(e)}"
        
        return jsonify({
            "success": True,
            "tables": tables_status,
            "expected_tables": tables_to_check,
            "system_type": "Direct PDF Chat"
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/debug/pdf/<int:pdf_id>/content', methods=['GET'])
def debug_pdf_content(pdf_id):
    """Debug endpoint to check what content exists for a specific PDF"""
    try:
        print(f" Debug: Fetching content for PDF {pdf_id}")
        
        # Get ALL content from database first
        content_response = make_db_request(f"/{CONTENT_TABLE}", method="GET")
        
        if not content_response or content_response.status_code != 200:
            error_msg = f"Failed to fetch content: {content_response.status_code if content_response else 'No response'}"
            print(f" {error_msg}")
            return jsonify({
                "success": False,
                "error": error_msg,
                "pdf_id": pdf_id
            })
        
        all_content = content_response.json()
        print(f" Total items in database: {len(all_content)}")
        
        # Find content for this PDF
        pdf_content = []
        for item in all_content:
            if ('data' in item and 
                isinstance(item['data'], dict) and 
                item['data'].get('pdf_id') == pdf_id):
                pdf_content.append(item)
        
        # Create content preview
        content_preview = []
        for item in pdf_content[:10]:  # Show first 10 items
            preview_item = {
                "id": item.get('id'),
                "kind": item.get('data', {}).get('kind', 'unknown'),
                "text_preview": "",
                "text_length": 0,
                "has_embedding": bool(item.get('embedding')),
                "embedding_length": len(item.get('embedding', [])) if item.get('embedding') else 0,
            }
            
            # Get text preview safely
            if isinstance(item.get('data'), dict) and 'text' in item['data']:
                text = item['data']['text']
                preview_item["text_length"] = len(text)
                preview_item["text_preview"] = text[:100] + "..." if len(text) > 100 else text
            
            content_preview.append(preview_item)
        
        return jsonify({
            "success": True,
            "pdf_id": pdf_id,
            "content_count": len(pdf_content),
            "total_content_in_db": len(all_content),
            "content_preview": content_preview
        })
            
    except Exception as e:
        error_msg = f"Debug PDF content error: {e}"
        print(f" {error_msg}")
        return jsonify({"success": False, "error": str(e), "pdf_id": pdf_id}), 500

# Error handlers
@app.errorhandler(413)
def file_too_large(e):
    return jsonify({
        "success": False,
        "error": "File too large. Maximum size is 50MB."
    }), 413

@app.errorhandler(404)
def not_found(e):
    # Only return 404 for actual 404s, not our custom endpoints
    if request.path.startswith('/api/'):
        return jsonify({
            "success": False,
            "error": f"API endpoint not found: {request.path}",
            "available_endpoints": [
                "/api/health",
                "/api/database-status", 
                "/api/init-db",
                "/api/clear-db",
                "/api/upload-pdf",
                "/api/pdfs",
                "/api/chat/<pdf_id>",
                "/api/pdf/<pdf_id>/messages",
                "/api/debug/tables"
            ]
        }), 404
    else:
        return jsonify({
            "success": False,
            "error": "Endpoint not found",
            "message": "This is a PDF-Chat API server. Try /api/health to test."
        }), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500

# ==================== MAIN ====================

def test_imports():
    """Test that all required dependencies are available"""
    missing_deps = []
    
    try:
        import flask
        print(" Flask imported successfully")
    except ImportError:
        missing_deps.append("flask")
    
    try:
        import flask_cors
        print(" Flask-CORS imported successfully")
    except ImportError:
        missing_deps.append("flask-cors")
    
    try:
        import requests
        print(" Requests imported successfully")
    except ImportError:
        missing_deps.append("requests")
    
    try:
        import numpy
        print(" NumPy imported successfully")
    except ImportError:
        missing_deps.append("numpy")
    
    try:
        from PyPDF2 import PdfReader
        print(" PyPDF2 imported successfully")
    except ImportError:
        missing_deps.append("PyPDF2")
    
    if missing_deps:
        print(f" Missing dependencies: {', '.join(missing_deps)}")
        print(f"Run: pip install {' '.join(missing_deps)}")
        return False
    
    return True

def test_cli_connection():
    """Test connection to CLI functions"""
    try:
        # Test database connection
        response = make_db_request("/health", method="GET")
        if response:
            print(" Database connection test successful")
        else:
            print(" Database connection test failed (but CLI functions are available)")
        return True
    except Exception as e:
        print(f" Database connection test failed: {e}")
        return True  # Continue anyway, might work when server starts

if __name__ == '__main__':
    print("=" * 80)
    print("  FIXED Flask PDF-Chat RAG API Server")
    print("=" * 80)
    
    # Test imports
    print("\n Testing dependencies...")
    if not test_imports():
        print(" Missing dependencies. Please install them first.")
        sys.exit(1)
    
    # Test CLI connection
    print("\n Testing CLI connection...")
    test_cli_connection()
    
    print("\n Key fixes applied:")
    print("Added root route (/) for basic server testing")
    print("Enhanced CORS configuration")
    print("Better error handling and logging")
    print("Improved 404 handler with helpful messages")
    print("Added dependency checking")
    print("  More detailed startup diagnostics")
    
    print("\n Available endpoints:")
    print("GET  /                           - Server status and endpoint list")
    print("GET  /api/health                 - Health check")
    print("GET  /api/database-status        - Check database status")
    print("POST /api/init-db                - Initialize database")
    print("POST /api/clear-db               - Clear database")
    print("GET  /api/pdfs                   - List PDFs")
    print("POST /api/upload-pdf             - Upload PDF")  
    print("POST /api/chat/<pdf_id>          - Chat with PDF")
    print("GET  /api/debug/tables           - Debug tables")
    
    print("\n Testing steps:")
    print("1. Start the server")
    print("2. Visit http://localhost:5000 to verify it's running")
    print("3. Test with: curl http://localhost:5000/api/health")
    print("4. Initialize DB: curl -X POST http://localhost:5000/api/init-db")
    
    print("\n Common troubleshooting:")
    print("   - 'Endpoint not found' → Check the URL path and method")
    print("   - 'CLI import error' → Make sure cli.py is in the same directory")
    print("   - 'Port in use' → Try a different port or kill existing process")
    print("   - Database errors → Check your API keys in cli.py")
    
    print(f"\n Starting server on http://localhost:5000")
    print("=" * 80)
    
    try:
        # Start the server with better error handling
        app.run(
            debug=True, 
            host='0.0.0.0', 
            port=5000,
            use_reloader=False  # Prevent double startup messages
        )
    except OSError as e:
        if "Address already in use" in str(e):
            print("\n Port 5000 is already in use!")
            print("   Solutions:")
            print("   1. Kill existing process: lsof -ti:5000 | xargs kill -9")
            print("   2. Use different port: app.run(port=5001)")
            print("   3. Wait a moment and try again")
        else:
            print(f" Server startup failed: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n Server stopped by user")
    except Exception as e:
        print(f"\n Unexpected error: {e}")
        traceback.print_exc()
        sys.exit(1)