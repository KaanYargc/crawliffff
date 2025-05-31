# Crawlify - Lead Generation Site

A lead generation platform built with Next.js, TypeScript, and Shadcn UI, featuring Google Maps API integration for finding businesses in Turkey.

## Features

- **Business Finder**: Search for businesses in Turkey using Google Maps API
  - Find businesses by type (e.g., plumbers, electricians) and city
  - View results on an interactive map
  - Export leads to CSV for your marketing campaigns
- **Lead Generation Form**: Collect contact information from potential clients
  - Form validation with Zod and React Hook Form
  - Toast notifications with Sonner
  - API route for processing form submissions
- Modern UI with Shadcn UI components
- Full TypeScript support
- Responsive design for mobile and desktop

## Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm, yarn, or pnpm
- Google Maps API Key with Places API enabled

### Environment Setup

1. Create a `.env.local` file in the project root with your Google Maps API key:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/crawlify.git
cd crawlify
```

2. Install dependencies
```bash
npm install
# or
yarn
# or
pnpm install
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Google Maps API Setup

To use the Business Finder feature, you need a Google Maps API key with the following APIs enabled:
- Maps JavaScript API
- Places API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to APIs & Services > Library
4. Enable the Maps JavaScript API and Places API
5. Create an API key from the Credentials page
6. Add the API key to your `.env.local` file

## API Integration

The lead generation form submits data to `/api/leads`. You can customize the API endpoint by:

1. Modifying the API route in `src/app/api/leads/route.ts` to connect to your backend services
2. Passing a different `apiEndpoint` prop to the `LeadForm` component in `src/app/page.tsx`

Example:
```tsx
<LeadForm apiEndpoint="https://your-api-endpoint.com/leads" />
```

## License

[MIT](https://choosealicense.com/licenses/mit/)
