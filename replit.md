# SmartCart - AI-Powered Shopping List Application

## Overview

SmartCart is a full-stack web application that provides intelligent shopping list management with AI-powered features. The application helps users manage their shopping lists, track purchase history, get smart suggestions based on purchasing patterns, and export lists to various e-commerce platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **AI Integration**: OpenAI API for smart suggestions and product categorization
- **Session Management**: Express sessions with PostgreSQL store

### Development Tools
- **Type Safety**: Full TypeScript coverage across client, server, and shared code
- **Code Quality**: ESLint and Prettier for code formatting
- **Development**: Hot reload with Vite HMR
- **Database Migrations**: Drizzle Kit for schema management

## Key Components

### Data Models
1. **Shopping Items**: Core shopping list items with categories and completion status
2. **Purchase History**: Historical data tracking when items were purchased
3. **Suggestions**: AI-generated recommendations based on purchase patterns
4. **E-commerce Matches**: Product mappings with URLs, images, prices, and confidence scores
5. **Advanced Product Database**: Optional external product catalog for enhanced matching

### Core Features
1. **Smart Shopping Lists**: Add, manage, and categorize shopping items in Italian
2. **Purchase History Tracking**: Monitor buying patterns and frequencies
3. **AI-Powered Suggestions**: Generate recommendations based on historical data
4. **Advanced Product Matching**: 3-phase AI system for high-precision product identification
5. **Shopping Cart View**: Visual cart with product images, details, and price totals
6. **E-commerce Integration**: Export lists to platforms (Amazon, Esselunga, Coop)
7. **Dual Mode Interface**: Switch between home and market shopping modes

### AI Services
1. **Smart Categorization**: Automatically categorize new items in Italian
2. **Purchase Prediction**: Suggest items based on buying frequency patterns
3. **Advanced Product Matching**: 3-phase AI system with structured query analysis
   - Phase 1: Query deconstruction (subject + modifiers)
   - Phase 2: Vector similarity search
   - Phase 3: Intelligent re-ranking
4. **Standard Product Matching**: Fallback OpenAI-based matching
5. **Cart Generation**: Create XML-formatted shopping carts with product images

## Data Flow

1. **Item Management**: Users add items → Auto-categorization via OpenAI → Storage in PostgreSQL
2. **Purchase Tracking**: Mark items as purchased → Generate purchase history → Update frequency patterns
3. **Smart Suggestions**: Analyze purchase history → Generate AI suggestions → Present to user
4. **Advanced E-commerce Matching**: 
   - Check for advanced database → 3-phase AI analysis → High-confidence matches
   - Fallback to standard OpenAI matching if database unavailable
5. **Shopping Cart View**: Display matched products with images, prices, and totals
6. **E-commerce Export**: Generate cart URLs/XML with product details

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL (serverless)
- **AI Service**: OpenAI API for natural language processing
- **UI Components**: Radix UI for accessible component primitives
- **Styling**: Tailwind CSS for utility-first styling

### Development Dependencies
- **Build Tools**: Vite, esbuild for fast builds
- **Type Checking**: TypeScript compiler
- **Database Tools**: Drizzle ORM and Drizzle Kit

### Runtime Dependencies
- **Server**: Express.js with middleware for CORS, sessions, JSON parsing
- **Client**: React with React Query for server state management
- **Validation**: Zod for runtime type validation
- **Date Handling**: date-fns for date manipulation

## Deployment Strategy

### Build Process
1. **Frontend Build**: Vite compiles React app to static assets
2. **Backend Build**: esbuild bundles Express server to ESM format
3. **Database**: Drizzle migrations ensure schema consistency

### Environment Configuration
- **Development**: Local development with Vite dev server and Express
- **Production**: Compiled static frontend served by Express server
- **Database**: Environment-based PostgreSQL connection strings

### Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- `NODE_ENV`: Environment flag for development/production

### Deployment Architecture
- **Single Process**: Express server serves both API and static frontend
- **Database**: Serverless PostgreSQL with connection pooling
- **Static Assets**: Compiled frontend assets served from Express
- **API Routes**: RESTful endpoints under `/api` prefix

## Recent Changes (January 2025)

### Mobile-Optimized Shopping Cart with Material Design 3
- **Date**: January 27, 2025
- **Change**: Complete redesign of shopping cart layout optimized for mobile readability and clean design
- **Updates**:
  - Material Design 3 styling throughout with proper color tokens and typography
  - Mobile-first layout with appropriately sized product images (24x24 on mobile, larger on desktop)
  - Clean card design with rounded corners (3xl) and proper spacing
  - Optimized product information display with centered mobile layout
  - Enhanced quantity controls with circular buttons and proper touch targets
  - Full-width action buttons on mobile with responsive grid on desktop
  - Improved price display with emphasized total pricing
  - Consistent MD3 color system and elevation patterns
- **Result**: Clean, mobile-friendly shopping cart with excellent readability and Material Design 3 consistency

### Updated App Graphics with Modern Icon System
- **Date**: January 27, 2025
- **Change**: Replaced FontAwesome with modern Lucide React icons throughout the application
- **Updates**:
  - Modern blue-purple gradient logo in header with shopping basket icon
  - Color-coded tab system: Lista (green), Storico (purple), Smart (blue), Matching (orange), Carrello (pink)
  - Consistent colored icons in component headers using gradient backgrounds
  - Updated all component imports to use unified Lucide React icon library
  - Fixed LSP errors including missing icon references and property naming issues
- **Result**: Cohesive, modern visual design with clear tab identification and professional appearance

### Fixed Confidence Values in Product Matching
- **Date**: January 27, 2025  
- **Issue**: All product matches showed fake "98% match" confidence regardless of quality
- **Solution**: Implemented dynamic confidence calculation system
- **Changes**:
  - Advanced matching: 70-95% confidence based on position, keyword match, brand availability
  - OpenAI matching: Instructed to provide realistic confidence values (30-95%)
  - Fallback system: Reduced to 30-45% confidence for better accuracy indication
- **Result**: Users now see meaningful confidence percentages that reflect actual match quality

## Previous Changes

### Administrative Panel Separation 
- **Date**: January 27, 2025
- **Feature**: Separated technical/admin features from user interface
- **Changes**:
  - Created `/admin` route with dedicated admin panel
  - Added Settings icon (⚙️) in main header for admin access
  - **User Features**: Created dedicated "Matching" tab in main interface for product matching
  - **Admin Features**: Only database management and AI configuration in admin panel
  - **Smart Cart**: Added Auto/Manual toggle for automatic best-match selection vs all matches
  - Simplified main user interface to focus on core shopping functionality
- **User Interface**: Main app shows Lista, Storico, Smart, Matching, Carrello
- **Admin Panel**: Technical features (Database, AI Setup) accessible via settings icon
- **Matching Logic**: Auto mode shows only highest confidence match per item, Manual shows all matches

### Advanced AI Matching System Integration
- **Date**: January 27, 2025
- **Feature**: Integrated Python-based 3-phase AI matching system
- **Components**:
  - `server/services/advanced-matching.ts`: Core advanced matching logic
  - `server/data/`: Directory for external product database files
  - Enhanced fallback system maintaining compatibility

### Vector Index Builder and Database Management
- **Date**: January 27, 2025
- **Feature**: Complete automated system for building vector indices from JSON product files
- **Components**:
  - `server/services/vector-index-builder.ts`: Automated processing of JSON product files
  - `server/data/prodotti/`: Upload directory for JSON product catalogs
  - `client/src/components/vector-index-manager.tsx`: UI for database management
  - `client/src/components/database-status.tsx`: Real-time system status monitoring
- **User Interface**: Integrated management panels in shopping cart view
- **Process**: Upload JSON files → AI enrichment → Generate cache and indices → Activate advanced matching

### Shopping Cart with Product Images
- **Date**: January 27, 2025  
- **Feature**: Complete shopping cart view with visual product display
- **Components**:
  - Product image URLs in matching results
  - Visual cart interface with photos and price totals
  - Integrated navigation in main application

### System Behavior
- **With Advanced Database**: Uses 3-phase AI system (98% confidence)
- **Without Database**: Falls back to OpenAI standard matching (85% confidence)
- **Files Required**: JSON product files in `server/data/prodotti/` → Auto-generates `cache_prodotti_gemini.json`, `indice_mappa.json`
- **File Upload Location**: `server/data/prodotti/` - Place your JSON product catalog files here

The application follows a monorepo structure with shared TypeScript types, enabling type safety across the entire stack while maintaining clear separation between client and server concerns.