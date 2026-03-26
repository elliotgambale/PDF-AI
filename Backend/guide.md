# Embedding Benchmark Guide

Use this guide to add Azure and LLMosaic embedding benchmark scripts directly in the repo’s root, following GitFlow conventions. Copy and paste the entire contents below into a `.md` file (e.g., `EMBEDDING_BENCHMARK_GUIDE.md`) in your repository.

---

## 1. Create a Feature Branch

1. From the repo’s root, switch to and update `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   ```
2. Create a new feature branch following GitFlow naming conventions:
   ```bash
   git checkout -b feature/embedding-benchmarks
   ```
3. All subsequent edits should be made on `feature/embedding-benchmarks`. When complete, you will open a Pull Request from `feature/embedding-benchmarks` → `develop`.

---

## 2. Update Dependencies

1. Open `requirements.txt` (located at the root). Ensure it contains at least:
   ```
   llama_index
   requests
   ```
   If these lines are missing, append them to the end of the file.

2. Install the updated requirements locally:
   ```bash
   pip install -r requirements.txt
   ```

3. Stage and commit the change:
   ```bash
   git add requirements.txt
   git commit -m "chore: add llama_index and requests to requirements.txt"
   ```

---

## 3. Document Required Environment Variables

1. Edit (or create) `.env.example` in the root to include:
   ```
   AZURE_EMBED_API_KEY=<your-azure-embed-key>
   AZURE_ENDPOINT=https://<your-azure-deployment>.openai.azure.com/
   LLMOSAIC_EMBED_KEY=<your-llmosaic-embed-key>
   LLMOSAIC_BASE_URL=https://gpu1.llmosaic.ai
   ```

2. Open `README.md` (in the root) and add a “Benchmarks” or “Environment Variables” section. For example:
   ```markdown
   ## Embedding Benchmark Environment Variables

   Before running the benchmarks, set these environment variables in your shell:

   - `AZURE_EMBED_API_KEY`  — Your Azure embeddings API key  
   - `AZURE_ENDPOINT`    — Your Azure endpoint URL (e.g. `https://<your-resource>.openai.azure.com/`)  
   - `LLMOSAIC_EMBED_KEY`  — Your LLMosaic embeddings API key  
   - `LLMOSAIC_BASE_URL`   — Base URL for LLMosaic embeddings (e.g. `https://gpu1.llmosaic.ai`)
   ```

3. Commit both `.env.example` and `README.md` updates:
   ```bash
   git add .env.example README.md
   git commit -m "docs: list required env vars for embedding benchmarks"
   ```

---

## 4. Add `bench_azure.py` to Root

1. Copy the original Azure test code into a new file named `bench_azure.py` at the root:
   ```bash
   cp path/to/original/azure_embeddings.py ./bench_azure.py
   ```

2. Open `bench_azure.py` and replace its contents with the following:

   ```python
   # bench_azure.py

   import os
   import time
   import statistics
   from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
   import logging, sys

   # Configure logging at INFO level (use DEBUG for verbose)
   logging.basicConfig(stream=sys.stdout, level=logging.INFO)
   logging.getLogger().addHandler(logging.StreamHandler(stream=sys.stdout))

   # Load Azure credentials from environment
   AZURE_API_KEY = os.environ["AZURE_EMBED_API_KEY"]
   AZURE_ENDPOINT = os.environ["AZURE_ENDPOINT"]
   AZURE_API_VERSION = "2023-05-15"

   # Initialize the Azure embedding model
   embed_model = AzureOpenAIEmbedding(
       model="text-embedding-ada-002",
       deployment_name="text-embedding-ada-002",
       api_key=AZURE_API_KEY,
       azure_endpoint=AZURE_ENDPOINT,
       api_version=AZURE_API_VERSION,
   )

   # Define test inputs of varying length
   test_texts = [
       "The quick brown fox jumps over the lazy dog.",
       "Artificial Intelligence and Machine Learning are revolutionizing the world.",
       "LLMosaic makes RAG easy!",
       "This is a longer sentence—say, fifty words—to see how embedding time scales with length. " * 2,
   ]

   repeats_per_input = 5
   latencies = []

   # Warm-up calls (optional; avoids cold-start variance)
   for text in test_texts[:2]:
       _ = embed_model.get_text_embedding(text)

   # Benchmark loop: measure time for each embedding call
   for text in test_texts:
       for _ in range(repeats_per_input):
           start = time.perf_counter()
           embedding = embed_model.get_text_embedding(text)
           end = time.perf_counter()
           latencies.append(end - start)

   # Compute statistics
   total_calls = len(latencies)
   total_time = sum(latencies)
   avg_latency = statistics.mean(latencies)
   stdev_latency = statistics.stdev(latencies) if total_calls > 1 else 0.0

   print("Azure Embedding Benchmark Results")
   print(f"  Total calls:      {total_calls}")
   print(f"  Average latency:  {avg_latency:.4f} s")
   print(f"  Std dev:          {stdev_latency:.4f} s")
   print(f"  Embeddings/sec:   {total_calls / total_time:.2f}")

   # Export raw latencies to CSV
   import csv
   with open("azure_benchmark.csv", "w", newline="") as f:
       writer = csv.writer(f)
       writer.writerow(["elapsed_seconds"])
       for t in latencies:
           writer.writerow([t])
   ```

3. Stage and commit `bench_azure.py`:
   ```bash
   git add bench_azure.py
   git commit -m "feat: add Azure embedding benchmark script at root"
   ```

---

## 5. Add `bench_llmosaic.py` to Root

1. Copy the original LLMosaic code into `bench_llmosaic.py` at the root:
   ```bash
   cp path/to/original/llmosaic_embeddings.py ./bench_llmosaic.py
   ```

2. Open `bench_llmosaic.py` and replace its contents with the following:

   ```python
   # bench_llmosaic.py

   import os
   import time
   import statistics
   import requests

   # Load LLMosaic credentials from environment
   LLM_BASE = os.environ["LLMOSAIC_BASE_URL"]      # e.g. "https://gpu1.llmosaic.ai"
   EMBED_KEY = os.environ["LLMOSAIC_EMBED_KEY"]
   EMBEDDING_MODEL = "bge-large-en-v1.5"
   HF_MODEL = "BAAI/bge-large-en-v1.5"

   # Define test inputs (same set as Azure for fair comparison)
   test_texts = [
       "The quick brown fox jumps over the lazy dog.",
       "Artificial Intelligence and Machine Learning are revolutionizing the world.",
       "LLMosaic makes RAG easy!",
       "This is a longer sentence—say, fifty words—to see how embedding time scales with length. " * 2,
   ]

   repeats_per_input = 5
   latencies = []

   # Warm-up call to avoid cold-start latency spikes
   warmup_payload = {"model": HF_MODEL, "input": [test_texts[0]]}
   _ = requests.post(
       f"{LLM_BASE}/{EMBEDDING_MODEL}/v1/embeddings",
       headers={
           "Authorization": f"Bearer {EMBED_KEY}",
           "Content-Type": "application/json",
       },
       json=warmup_payload,
   )

   # Benchmark loop: measure elapsed time for each request
   for text in test_texts:
       payload = {"model": HF_MODEL, "input": [text]}
       for _ in range(repeats_per_input):
           start = time.perf_counter()
           response = requests.post(
               f"{LLM_BASE}/{EMBEDDING_MODEL}/v1/embeddings",
               headers={
                   "Authorization": f"Bearer {EMBED_KEY}",
                   "Content-Type": "application/json",
               },
               json=payload,
           )
           elapsed = time.perf_counter() - start
           latencies.append(elapsed)

           if response.status_code != 200:
               print(f"Error {response.status_code}: {response.text}")

   # Compute statistics
   total_calls = len(latencies)
   total_time = sum(latencies)
   avg_latency = statistics.mean(latencies)
   stdev_latency = statistics.stdev(latencies) if total_calls > 1 else 0.0

   print("LLMosaic Embedding Benchmark Results")
   print(f"  Total calls:      {total_calls}")
   print(f"  Average latency:  {avg_latency:.4f} s")
   print(f"  Std dev:          {stdev_latency:.4f} s")
   print(f"  Embeddings/sec:   {total_calls / total_time:.2f}")

   # Export raw latencies to CSV
   import csv
   with open("llmosaic_benchmark.csv", "w", newline="") as f:
       writer = csv.writer(f)
       writer.writerow(["elapsed_seconds"])
       for t in latencies:
           writer.writerow([t])
   ```

3. Stage and commit `bench_llmosaic.py`:
   ```bash
   git add bench_llmosaic.py
   git commit -m "feat: add LLMosaic embedding benchmark script at root"
   ```

---

## 6. Update `README.md` with How-to-Run

1. Open `README.md` (in the root) and add (or append) a “Running Benchmarks” section. For example:
   ```markdown
   ## Running the Embedding Benchmarks

   1. Make sure the environment variables are set in your shell (or via `source .env`):

      ```bash
      export AZURE_EMBED_API_KEY="..."
      export AZURE_ENDPOINT="https://<your-azure-endpoint>.openai.azure.com/"
      export LLMOSAIC_EMBED_KEY="..."
      export LLMOSAIC_BASE_URL="https://gpu1.llmosaic.ai"
      ```

   2. From the repo root, run:

      ```bash
      python bench_azure.py
      python bench_llmosaic.py
      ```

   3. Each script will:
      - Print total calls, average latency, standard deviation, and embeddings/second.
      - Write a CSV (`azure_benchmark.csv` / `llmosaic_benchmark.csv`) containing raw per-call latencies.

   4. Compare the printed results or analyze the CSVs in a spreadsheet/plotting tool.
   ```

2. Commit the `README.md` update:
   ```bash
   git add README.md
   git commit -m "docs: add instructions for running bench_azure.py and bench_llmosaic.py"
   ```

---

## 7. Final Push & Pull Request

1. Push your feature branch to the remote:
   ```bash
   git push -u origin feature/embedding-benchmarks
   ```
2. Open a Pull Request from `feature/embedding-benchmarks` into `develop`. In the PR description, note:
   - You added two new scripts (`bench_azure.py`, `bench_llmosaic.py`) at the repo root.
   - You updated `requirements.txt`, `.env.example`, and `README.md`.
   - How to set environment variables and run the benchmarks.

Once approved and merged into `develop`, delete the feature branch:

```bash
git checkout develop
git pull origin develop
git branch -d feature/embedding-benchmarks
git push origin --delete feature/embedding-benchmarks
```

---

### Summary

1. **Branch off** `develop` → `feature/embedding-benchmarks`.  
2. **Add (at root)**  
   - `bench_azure.py`  
   - `bench_llmosaic.py`  
3. **Update (at root)**  
   - `requirements.txt`  
   - `.env.example`  
   - `README.md`  
4. **Commit each logical change** with a clear message.  
5. **Push** and open a PR → `develop`, then merge.  
6. **Clean up** the feature branch.  

Now the benchmark scripts live at the root, follow GitFlow conventions, and are documented.  
