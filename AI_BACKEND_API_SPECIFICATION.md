# AI Backend API Specification for TableReserve

## Overview

This document describes the exact API specification required for the AI chatbot backend to maintain compatibility with the existing frontend UI implementation. The frontend expects specific response formats and structures to properly display restaurant recommendations and chat messages.

## Core Response Format

### AI Response Structure

The AI responses must follow a specific pattern that the frontend can parse:

```
[Conversational text response]
RESTAURANTS_TO_SHOW: restaurant-id-1,restaurant-id-2,restaurant-id-3
```

**Important**: The `RESTAURANTS_TO_SHOW:` section is optional and should only be included when the AI wants to display specific restaurant cards to the user.

## API Endpoints Required

### 1. Chat Endpoint

```http
POST /api/chat
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "string (required)",
  "session_id": "string (optional, defaults to 'default')"
}
```

**Response Body:**
```json
{
  "response": "string (the conversational text part only)",
  "restaurants_to_show": ["restaurant-id-1", "restaurant-id-2"],
  "session_id": "string",
  "status": "success"
}
```

**Error Response:**
```json
{
  "error": "string",
  "message": "string (optional)",
  "status": "error"
}
```

### 2. Health Check Endpoint

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "ISO-8601-timestamp"
}
```

### 3. Chat Reset Endpoint

```http
POST /api/chat/reset
Content-Type: application/json
```

**Request Body:**
```json
{
  "session_id": "string (optional)"
}
```

**Response Body:**
```json
{
  "message": "Chat history cleared",
  "session_id": "string",
  "status": "success"
}
```

### 4. Chat History Endpoint

```http
GET /api/chat/history?session_id=string
```

**Response Body:**
```json
{
  "history": [
    {
      "role": "user | assistant",
      "content": "string",
      "timestamp": "ISO-8601-timestamp"
    }
  ],
  "session_id": "string",
  "status": "success"
}
```

## Frontend Processing Logic

### How the Frontend Handles Responses

1. **Message Parsing**: The frontend splits AI responses on `"RESTAURANTS_TO_SHOW:"` to separate conversational text from restaurant IDs
2. **Restaurant Data Fetching**: When restaurant IDs are provided, the frontend fetches full restaurant details from Supabase
3. **UI Rendering**: Creates chat bubbles with text + horizontal scrollable restaurant cards

### Frontend Integration Code Example

```typescript
// Frontend processing (from chat_test_py.tsx)
async function sendMessageToFlaskAPI(message: string, sessionId?: string): Promise<ChatMessage> {
  const response = await fetch(`${FLASK_API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message,
      session_id: sessionId || "default",
    }),
  });

  const data = await response.json();

  // Fetch restaurant details if IDs were returned
  let restaurants: any[] = [];
  if (data.restaurants_to_show && data.restaurants_to_show.length > 0) {
    const { data: restaurantData } = await supabase
      .from("restaurants")
      .select("*")
      .in("id", data.restaurants_to_show);

    // Maintain order from API response
    const restaurantMap = new Map(restaurantData?.map((r) => [r.id, r]));
    restaurants = data.restaurants_to_show
      .map((id: string) => restaurantMap.get(id))
      .filter(Boolean);
  }

  return {
    role: "assistant",
    content: data.response,
    restaurants: restaurants.length > 0 ? restaurants : undefined,
  };
}
```

## AI System Requirements

### System Prompt Guidelines

Your AI should be configured with these constraints:

```
You are a specialized restaurant assistant for TableReserve. Your role is to:
1. Help users find restaurants based on their preferences
2. Provide information about restaurants including cuisine type, price range, and features
3. Answer questions about restaurant availability and booking policies
4. Be friendly and professional in your responses

RESPONSE FORMAT:
When recommending specific restaurants, format your response as:
1. Start with conversational text
2. Add "RESTAURANTS_TO_SHOW:" on a new line
3. List restaurant IDs separated by commas

Example:
"I found some great Italian restaurants for you!
RESTAURANTS_TO_SHOW: restaurant-1,restaurant-2,restaurant-3"

CONSTRAINTS:
- ONLY answer restaurant-related questions
- Always use restaurant IDs from the database
- Prioritize restaurants with ai_featured=true
- Base responses on actual restaurant data
```

### Restaurant Data Access

Your AI needs access to restaurant data with these key fields:

```sql
-- Required restaurant table columns for AI queries
id, name, description, address, tags, cuisine_type, price_range, 
average_rating, dietary_options, ambiance_tags, outdoor_seating, 
ai_featured, booking_policy, phone_number, parking_available, 
shisha_available, featured
```

**Important**: Restaurants with `ai_featured = true` should be prioritized and shown first in responses.

## Restaurant Card Display

### Frontend UI Components

The frontend uses these components to display restaurant recommendations:

- **MessageBubble**: Renders chat text + optional restaurant cards
- **RestaurantCard**: Individual restaurant card component with variant="featured"
- **OptimizedList**: Horizontal scrollable list for restaurant cards

### Card Layout Features

- Horizontal scrolling with snap-to-interval
- Card width: `screenWidth - 80px`
- Pagination indicators for multiple restaurants
- Touch handling for restaurant selection
- Automatic navigation to restaurant detail pages

## Error Handling

### API Error Responses

All endpoints should return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (missing/invalid parameters)
- `500`: Internal Server Error

### Frontend Error Handling

The frontend includes:
- Connection status monitoring
- Automatic retry logic
- User-friendly error messages
- Fallback to offline mode

## Session Management

### Session Features

- Session-based chat history
- Multiple concurrent sessions support
- Session cleanup/reset functionality
- Persistent conversation context

### Session ID Format

- String identifier (UUIDs recommended)
- Default to "default" if not provided
- Used for conversation continuity

## Testing & Validation

### API Health Monitoring

The frontend continuously monitors API health via `/api/health` endpoint and displays connection status to users.

### Response Validation

Ensure your API validates:
- Restaurant IDs exist in database
- Response format matches specification
- Session management works correctly
- Error responses are properly formatted

## Migration Notes

### Replacing Current AI

To replace the current frontend AI with your backend API:

1. **Update API URL**: Change `FLASK_API_BASE_URL` in `chat_test_py.tsx`
2. **Maintain Response Format**: Ensure your API returns the exact JSON structure specified
3. **Test Restaurant Display**: Verify restaurant cards render correctly
4. **Session Compatibility**: Ensure session management works as expected

### Backward Compatibility

The current system supports both:
- Local AI agent (`AI_Agent.ts`) 
- Flask API backend (`chat_test_py.tsx`)

Your new backend should follow the Flask API pattern for seamless integration.

---

## Summary

By following this specification exactly, your backend AI will integrate seamlessly with the existing TableReserve frontend, maintaining the current restaurant display functionality while providing flexibility for your custom AI implementation.

Key success factors:
1. **Exact JSON response format** matching the specification
2. **Proper restaurant ID handling** for frontend data fetching
3. **Consistent API endpoints** for chat, health, and session management
4. **Error handling** that matches frontend expectations
