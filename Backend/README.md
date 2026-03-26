# Embedding Model Benchmarks 
## Embedding Benchmark Environment Variables 
 
Before running the benchmarks, set these environment variables in your shell: 
 
- AZURE_EMBED_API_KEY - Your Azure embeddings API key 
- AZURE_ENDPOINT - Your Azure endpoint URL (e.g. https://your-resource.openai.azure.com/) 
- LLMOSAIC_EMBED_KEY - Your LLMosaic embeddings API key 
- LLMOSAIC_BASE_URL - Base URL for LLMosaic embeddings (e.g. https://gpu1.llmosaic.ai) 
 
## Running the Embedding Benchmarks 
 
1. Make sure the environment variables are set in your shell (or via source .env): 
 
   export AZURE_EMBED_API_KEY="..." 
   export AZURE_ENDPOINT="https://your-azure-endpoint.openai.azure.com/" 
   export LLMOSAIC_EMBED_KEY="..." 
   export LLMOSAIC_BASE_URL="https://gpu1.llmosaic.ai" 
 
2. From the repo root, run: 
 
   python bench_azure.py 
   python bench_llmosaic.py 
 
3. Each script will: 
   - Print total calls, average latency, standard deviation, and embeddings/second. 
   - Write a CSV (azure_benchmark.csv / llmosaic_benchmark.csv) containing raw per-call latencies. 
 
4. Compare the printed results or analyze the CSVs in a spreadsheet/plotting tool. 


# CLI.PY

# PDF Parser CLI with RAG Chat

A command-line interface for parsing PDF documents, creating embeddings, storing them in a vector database, and enabling interactive chat using Retrieval-Augmented Generation (RAG).

## Features

- **PDF Parsing**: Extract and process text from specific PDF pages
- **Token-Aware Splitting**: Automatically split content into chunks under 512 tokens while preserving sentence boundaries
- **Vector Embeddings**: Generate embeddings using BGE-large-en-v1.5 model
- **Vector Database**: Store embeddings in a PostgreSQL database with vector search capabilities
- **RAG Chat**: Interactive chat that combines document context with general LLM knowledge
- **Flexible Commands**: Initialize, clear, parse, ingest, and chat operations

## Installation

### 1. Install Dependencies

pip install -r requirements.txt


### 2. Required Python Packages (requirements.txt)

docopt==0.6.2
PyPDF2==3.0.1
requests>=2.28.0

## Setup

### 1. API Keys and Configuration

The CLI uses several external services that require API keys. Update the configuration section in `cli.py`:

# ——— Configuration ———
DB_KEY = "your_database_api_key_here"
DB_BASE = "https://api.db.llmosaic.ai"
LLM_KEY = "your_llm_api_key_here"
LLM_BASE = "https://gpu1.llmosaic.ai"
EMBED_KEY = "your_embedding_api_key_here"
EMBEDDING_MODEL = "bge-large-en-v1.5"
EMBED_HF_MODEL = "BAAI/bge-large-en-v1.5"


### 2. Required Services

- **Vector Database**: PostgreSQL with pgvector extension (via LLMosaic DB API)
- **LLM Service**: Llama 3.1-8B-Instruct model (via LLMosaic GPU API)
- **Embedding Service**: BGE-large-en-v1.5 model (via LLMosaic embedding API)

### 3. PDF Configuration

By default, the CLI processes pages 16-23 (0-indexed as 15-22) of PDF documents. Modify `PDF_PAGE_RANGE` in the configuration if needed:


PDF_PAGE_RANGE = (15, 23)  # Pages 16-23 (0-indexed)


## Commands

### `init-db`
**Purpose**: Initialize the database by creating the table structure and vector index.


python cli.py init-db


**What it does**:
- Drops existing table (if exists)
- Creates `items5` table with columns: `id`, `data` (JSON), `embedding` (vector)
- Creates HNSW vector index for efficient similarity search
- Sets up cosine distance operator for vector comparisons

### `clear-db`
**Purpose**: Clear all data from the database table without dropping the structure.

python cli.py clear-db


**What it does**:
- Removes all records from the `items5` table
- Preserves table structure and indexes
- Useful for starting fresh with new documents

### `parse <file_path>`
**Purpose**: Parse a PDF file and display the content groups without storing them.

python cli.py parse document.pdf


**What it does**:
- Extracts text from specified PDF pages
- Preprocesses text (removes line-break hyphens, normalizes spaces)
- Groups content by type (headers, bullets, paragraphs)
- Splits large groups to stay under 512 token limit
- Displays each group with estimated token count
- **Does not** create embeddings or store in database


### `ingest <file_path>`
**Purpose**: Parse a PDF file, create embeddings, and store in the database.

python cli.py ingest document.pdf


**What it does**:
- Performs all steps from `parse` command
- Generates vector embeddings for each content group
- Stores groups in database with embeddings for similarity search
- Provides progress feedback during ingestion
- Reports success/failure statistics


### `chat`
**Purpose**: Start an interactive chat session using RAG with ingested PDF content.

python cli.py chat

**What it does**:
- Starts interactive chat loop
- For each question, creates embedding and searches database
- Retrieves top 5 most similar content pieces
- Combines document context with general LLM knowledge
- Provides comprehensive answers using both sources
- Shows which sources were used

## Chat Feature Usage

### Starting a Chat Session

python cli.py chat


### Chat Features

1. **Hybrid Responses**: Combines specific document content with general LLM knowledge
2. **Context Awareness**: Shows how many document sections were used
3. **Fallback Handling**: Still provides answers when no relevant document content is found
4. **Error Recovery**: Continues chat even if embedding or search fails temporarily
5. **Source Attribution**: Indicates whether answers use document content or general knowledge

### Chat Commands

- **Regular questions**: Ask anything related to your document or general topics
- **`quit`** or **`exit`**: End the chat session
- **Ctrl+C**: Emergency exit



## Workflow

### Typical Usage Pattern

1. **First-time setup**:

   python cli.py init-db

2. **Preview document content**:

   python cli.py parse mydocument.pdf
   

3. **Ingest document for chat**:
   
   python cli.py ingest mydocument.pdf


4. **Start chatting**:
   
   python cli.py chat
   

5. **Clear and start over** (if needed):
   
   python cli.py clear-db
   python cli.py ingest newdocument.pdf
   

## Configuration Options

### Token Limits

MAX_TOKENS = 512          # Maximum tokens per chunk
BUFFER_TOKENS = 10        # Safety buffer for tokenization


### Database Settings

TABLE_NAME = "items5"     # Database table name


### PDF Processing

PDF_PAGE_RANGE = (15, 23) # Pages to extract (0-indexed)


## Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure all API keys are properly configured
2. **PDF Reading Errors**: Check file path and PDF accessibility
3. **Database Connection**: Verify database service availability
4. **Token Limit Warnings**: Content is automatically split, warnings are informational
5. **Empty Search Results**: Document may not contain relevant content for the query

### Error Messages

- **"Embedding API error"**: Check embedding service API key and connectivity
- **"DB insertion failed"**: Database connection or permission issues
- **"No pages extracted"**: PDF file issues or incorrect page range
- **"Group still exceeds token limit"**: Rare edge case, content will still be processed

## Technical Details

- **Embedding Model**: BGE-large-en-v1.5 (1024-dimensional vectors)
- **Token Estimation**: ~4 characters per token (rough approximation)
- **Vector Index**: HNSW with cosine distance
- **Content Types**: Headers (ALL-CAPS with colon), Bullets (•, -, *, o), Paragraphs
- **Sentence Splitting**: Preserves sentence boundaries during token-based splitting