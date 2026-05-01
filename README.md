# Pixvora - AI Smart Photo Sharing Platform

Pixvora is an AI-powered smart photo sharing platform tailored for event photographers and their guests. It uses advanced facial recognition to securely distribute photos, allowing guests to find their moments with a single selfie.

## Architecture

Pixvora consists of three main pillars:
1. **Frontend (React / Vite)**: A premium, dynamic user interface for both the photographer dashboard and the guest selection portal. Uses TailwindCSS, Framer Motion, and Lucide Icons.
2. **Backend (FastAPI)**: Handles AI processing, secure access verification, and DB-backed guest sessions. Uses `DeepFace` for facial feature extraction.
3. **Database & Storage (Supabase)**: Provides PostgreSQL with `pgvector` for scalable facial embedding matching, as well as secure cloud storage for high-resolution and watermarked photos.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Supabase account & project

### 1. Frontend Setup
1. Navigate to the root directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your environment variables in `.env`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_BACKEND_URL=http://localhost:8000
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

### 2. Backend Setup
1. Navigate to the `backend/` directory.
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set your environment variables:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_jwt_secret
   FRONTEND_URL=http://localhost:5173
   APP_ENV=development
   ```
5. Run the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## Key Features
- **AI Matching**: Instantly finds guests across thousands of event photos using DeepFace and pgvector.
- **Secure Access Control**: Event portals are protected via password or OTP checks, signed session tokens, and durable `share_sessions` records in Supabase.
- **Watermarking & Downsampling**: Protects photographer's intellectual property until guests unlock or purchase high-resolution versions.
- **Photographer Dashboard**: Manage events, photo uploads, pricing bundles, and branding.
