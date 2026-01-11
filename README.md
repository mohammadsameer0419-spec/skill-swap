# 🚀 Skill Relay Chain
**The Decentralized Skill Economy**

[Live Demo](https://your-vercel-link.vercel.app) | [Video Walkthrough](your-youtube-link) | [Documentation](./docs/SYSTEM_DOCUMENTATION.md)

---
## 🎯 Overview

Skill Relay Chain is a peer-to-peer skill exchange platform that enables users to teach and learn skills using a credit-based economy. Built with React, TypeScript, Supabase, and AI-powered matching, it creates a self-sustaining ecosystem where knowledge flows seamlessly between learners and teachers.

### ✨ Key Features

- **🎓 5-Level Growth Model** - Gamified progression system with level-based unlocks
- **💳 Credit Ledger System** - Atomic transaction-based credit management with full audit trail
- **🤖 AI-Powered Matching** - Semantic search using OpenAI embeddings and pgvector (HNSW indexing)
- **📹 Live Classes** - Real-time video classes powered by Stream Video SDK
- **🏆 Micro-Certifications** - Verified certificates with public QR code verification
- **🎯 Bounty Board** - Pull-model marketplace where beginners can request skills
- **🗺️ AI Roadmap Generator** - Personalized 4-week learning paths mapped to resources

---
## 🛠 Quick Start for Judges

### Test Credentials:
- **Email:** demo@skillrelay.com
- **Password:** hackathon2024

*(Or simply sign up to experience the AI-powered onboarding!)*

### 🚀 Running Locally

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd myapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_OPENAI_API_KEY=your_openai_api_key
   VITE_STREAM_API_KEY=your_stream_api_key
   VITE_STREAM_API_SECRET=your_stream_api_secret
   ```

4. **Run database migrations**
   ```bash
   # Apply all migrations in supabase/migrations/
   # Using Supabase CLI or Dashboard
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   Navigate to `http://localhost:5173`

---
## 📚 Documentation

- [System Documentation](./docs/SYSTEM_DOCUMENTATION.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Implementation Status](./docs/IMPLEMENTATION_STATUS.md)
- [Feature Verification](./FEATURE_VERIFICATION.md)

---
## 🏗️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **ShadCN/ui** - Component library
- **TanStack Query** - Data fetching and caching
- **Framer Motion** - Animations
- **React Router** - Routing

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Row Level Security (RLS)
  - Edge Functions (Deno)
  - Realtime subscriptions
- **pgvector** - Vector similarity search (HNSW indexing)
- **OpenAI API** - Embeddings and AI-powered features

### Infrastructure
- **Stream Video SDK** - Live video classes
- **canvas-confetti** - Celebration effects
- **sonner** - Toast notifications

---
## 🎨 Key Components

### Core Features
- **Onboarding Flow** - Multi-step onboarding with initial credit grant
- **Skill Matching** - AI-enhanced semantic search with pgvector
- **Credit System** - Ledger-based transactions with atomic operations
- **Live Classes** - Real-time video classes with Stream Video
- **Bounty Board** - Pull-model marketplace
- **AI Roadmap Generator** - 4-week personalized learning paths
- **Micro-Certifications** - Verified certificates with QR codes
- **5-Level Growth Model** - Gamified progression system

### Database Schema
- **profiles** - User profiles with levels and credits
- **skills** - Skill listings with embeddings
- **skill_sessions** - Session lifecycle management
- **credit_transactions** - Ledger-based credit tracking
- **reviews** - Bi-directional reviews
- **certificates** - Verified micro-certifications
- **live_classes** - Live class management
- **bounties** - Bounty board posts
- **notifications** - Real-time notifications

---
## 🔒 Security Features

- **Row Level Security (RLS)** - Database-level access control
- **Service Role Functions** - Secure server-side operations
- **JWT Authentication** - Supabase Auth integration
- **Input Validation** - Zod schemas for type safety
- **Atomic Transactions** - Race-condition safe operations
- **Idempotency Checks** - Prevents duplicate operations

---
## 📊 Performance Optimizations

- **HNSW Indexing** - O(log n) vector similarity search
- **React Query** - Intelligent caching and background updates
- **Server-Side Filtering** - All filtering done in database
- **Optimistic Updates** - Instant UI feedback
- **Code Splitting** - Lazy-loaded components

---
## 🤝 Contributing

This is a hackathon project. For questions or feedback, please contact the team.

---
## 📝 License

This project was built for a hackathon. All rights reserved.

---
## 👥 Team

Built with ❤️ by the Skill Relay Chain team

---
## 🙏 Acknowledgments

- Supabase for the amazing backend platform
- OpenAI for embeddings and AI features
- Stream for video infrastructure
- ShadCN for beautiful UI components
