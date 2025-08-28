# Excel Data Manager - Cloud Edition

A comprehensive Next.js 15 application for uploading, processing, and managing Excel data with real-time features and cloud deployment capabilities. Successfully deployed on Vercel with Supabase PostgreSQL backend.

## 🚀 Features

- **📈 Excel Processing**: Upload and parse .xlsx/.xls files with automatic data extraction
- **🔄 Data Aggregation**: Intelligent grouping by item ID, name, and unit with quantity summation
- **📊 Interactive Management**: Edit, delete, and export functionality with TanStack Table
- **📱 Responsive Design**: Mobile-first UI with dark mode support
- **🗂️ Structure Preservation**: Maintains original Excel format for perfect export recreation
- **💾 Cloud Database**: Supabase PostgreSQL with optimized connection pooling
- **🔌 Real-time Communication**: Socket.IO integration for live updates
- **⚡ Serverless Ready**: Optimized for Vercel deployment with runtime migration checks

## ✨ Technology Stack

### 🎯 Frontend
- **⚡ Next.js 15** - App Router with React Server Components
- **📘 TypeScript 5** - Full type safety across the application
- **🎨 Tailwind CSS 4** - Utility-first CSS with modern features
- **🧩 shadcn/ui** - High-quality components built on Radix UI
- **📊 TanStack Table** - Powerful data tables with editing capabilities
- **📈 Recharts** - Beautiful charts and data visualization
- **🐻 Zustand** - Lightweight state management
- **🔄 TanStack Query** - Server state synchronization

### 🗄️ Backend & Database
- **🗄️ Prisma ORM** - Type-safe database client with PostgreSQL
- **🐘 Supabase** - Managed PostgreSQL with real-time capabilities
- **🔌 Socket.IO** - Real-time WebSocket communication
- **📊 Custom Server** - Node.js server combining Next.js + Socket.IO

### ☁️ Deployment & Infrastructure
- **⚡ Vercel** - Serverless functions with edge computing
- **🔗 Connection Pooling** - Optimized for serverless with Supabase pooler
- **🛡️ Runtime Migrations** - Database verification at runtime
- **🌍 IPv4 Compatible** - Configured for Vercel's network requirements

### 🎨 Advanced UI Features
- **📊 TanStack Table** - Headless UI for building tables and datagrids
- **🖱️ DND Kit** - Modern drag and drop toolkit for React
- **📊 Recharts** - Redefined chart library built with React and D3
- **🖼️ Sharp** - High performance image processing

### 🌍 Internationalization & Utilities
- **🌍 Next Intl** - Internationalization library for Next.js
- **📅 Date-fns** - Modern JavaScript date utility library
- **🪝 ReactUse** - Collection of essential React hooks for modern development

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### Local Development

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd excel-data-manager
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your Supabase credentials:
   ```env
   # Use pooler URLs for Vercel compatibility
   DATABASE_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
   DIRECT_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"
   ```

3. **Database Setup**
   ```bash
   npm run db:push      # Push schema to Supabase
   npm run db:generate  # Generate Prisma client
   ```

4. **Start Development**
   ```bash
   npm run dev  # Custom server with Socket.IO
   ```

Open [http://localhost:3000](http://localhost:3000) to see your application.

## 🤖 Powered by Z.ai

This scaffold is optimized for use with [Z.ai](https://chat.z.ai) - your AI assistant for:

- **💻 Code Generation** - Generate components, pages, and features instantly
- **🎨 UI Development** - Create beautiful interfaces with AI assistance  
- **🔧 Bug Fixing** - Identify and resolve issues with intelligent suggestions
- **📝 Documentation** - Auto-generate comprehensive documentation
- **🚀 Optimization** - Performance improvements and best practices

Ready to build something amazing? Start chatting with Z.ai at [chat.z.ai](https://chat.z.ai) and experience the future of AI-powered development!

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable React components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
└── lib/                # Utility functions and configurations
```

## 🎨 Available Features & Components

This scaffold includes a comprehensive set of modern web development tools:

### 🧩 UI Components (shadcn/ui)
- **Layout**: Card, Separator, Aspect Ratio, Resizable Panels
- **Forms**: Input, Textarea, Select, Checkbox, Radio Group, Switch
- **Feedback**: Alert, Toast (Sonner), Progress, Skeleton
- **Navigation**: Breadcrumb, Menubar, Navigation Menu, Pagination
- **Overlay**: Dialog, Sheet, Popover, Tooltip, Hover Card
- **Data Display**: Badge, Avatar, Calendar

### 📊 Advanced Data Features
- **Tables**: Powerful data tables with sorting, filtering, pagination (TanStack Table)
- **Charts**: Beautiful visualizations with Recharts
- **Forms**: Type-safe forms with React Hook Form + Zod validation

### 🎨 Interactive Features
- **Animations**: Smooth micro-interactions with Framer Motion
- **Drag & Drop**: Modern drag-and-drop functionality with DND Kit
- **Theme Switching**: Built-in dark/light mode support

### 🔐 Backend Integration
- **Authentication**: Ready-to-use auth flows with NextAuth.js
- **Database**: Type-safe database operations with Prisma
- **API Client**: HTTP requests with Axios + TanStack Query
- **State Management**: Simple and scalable with Zustand

### 🌍 Production Features
- **Internationalization**: Multi-language support with Next Intl
- **Image Optimization**: Automatic image processing with Sharp
- **Type Safety**: End-to-end TypeScript with Zod validation
- **Essential Hooks**: 100+ useful React hooks with ReactUse for common patterns

## 🤝 Get Started with Z.ai

1. **Clone this scaffold** to jumpstart your project
2. **Visit [chat.z.ai](https://chat.z.ai)** to access your AI coding assistant
3. **Start building** with intelligent code generation and assistance
4. **Deploy with confidence** using the production-ready setup

---

Built with ❤️ for the developer community. Supercharged by [Z.ai](https://chat.z.ai) 🚀
# inwentura_op
