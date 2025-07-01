from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from AI_Agent import chat_with_bot, reset_chat, get_chat_history
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('restaurant_agent.log'),
        logging.StreamHandler()
    ]
)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Store chat sessions by session ID (you can implement more sophisticated session management)
chat_sessions = {}

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'message': 'Restaurant AI Agent API is running'
    }), 200

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Main chat endpoint to send messages to the AI agent.
    Expected JSON payload:
    {
        "message": "user message here",
        "session_id": "optional_session_id"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({
                'error': 'Message is required',
                'status': 'error'
            }), 400
        
        user_message = data['message'].strip()
        session_id = data.get('session_id', 'default')
        
        if not user_message:
            return jsonify({
                'error': 'Message cannot be empty',
                'status': 'error'
            }), 400
        
        logging.info(f"Received message from session {session_id}: {user_message}")
        
        # Get AI response using the existing chat_with_bot function
        ai_response = chat_with_bot(user_message)
        
        logging.info(f"AI response for session {session_id}: {ai_response}")
        
        # Check if response contains restaurant recommendations
        restaurants_to_show = []
        response_text = ai_response
        
        if "RESTAURANTS_TO_SHOW:" in ai_response:
            parts = ai_response.split("RESTAURANTS_TO_SHOW:")
            response_text = parts[0].strip()
            if len(parts) > 1:
                restaurant_ids = [id.strip() for id in parts[1].strip().split(',') if id.strip()]
                restaurants_to_show = restaurant_ids
        
        return jsonify({
            'response': response_text,
            'restaurants_to_show': restaurants_to_show,
            'session_id': session_id,
            'status': 'success'
        }), 200
        
    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e),
            'status': 'error'
        }), 500

@app.route('/api/chat/reset', methods=['POST'])
def reset_chat_history():
    """
    Reset chat history for a session.
    Expected JSON payload:
    {
        "session_id": "optional_session_id"
    }
    """
    try:
        data = request.get_json() or {}
        session_id = data.get('session_id', 'default')
        
        # Reset the global chat state (you might want to implement per-session state)
        reset_chat()
        
        logging.info(f"Chat history reset for session {session_id}")
        
        return jsonify({
            'message': 'Chat history reset successfully',
            'session_id': session_id,
            'status': 'success'
        }), 200
        
    except Exception as e:
        logging.error(f"Error resetting chat history: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e),
            'status': 'error'
        }), 500

@app.route('/api/chat/history', methods=['GET'])
def get_history():
    """
    Get chat history for debugging purposes.
    Query parameters:
    - session_id: optional session identifier
    """
    try:
        session_id = request.args.get('session_id', 'default')
        
        # Get chat history using the existing function
        history = get_chat_history()
        
        # Convert messages to a serializable format
        formatted_history = []
        for i, msg in enumerate(history):
            msg_type = "user" if hasattr(msg, 'content') and hasattr(msg, '__class__') and 'Human' in msg.__class__.__name__ else "ai"
            formatted_history.append({
                'id': i + 1,
                'type': msg_type,
                'content': msg.content if hasattr(msg, 'content') else str(msg),
                'timestamp': None  # You can add timestamps if needed
            })
        
        return jsonify({
            'history': formatted_history,
            'session_id': session_id,
            'total_messages': len(formatted_history),
            'status': 'success'
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting chat history: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e),
            'status': 'error'
        }), 500

@app.route('/api/restaurants/cuisines', methods=['GET'])
def get_cuisine_types():
    """
    Get all available cuisine types.
    This can be useful for frontend dropdowns or filters.
    """
    try:
        from AI_Agent import getAllCuisineTypes
        
        # Call the tool directly to get cuisine types
        cuisine_types_str = getAllCuisineTypes()
        
        # Parse the JSON response
        import json
        try:
            cuisine_types = json.loads(cuisine_types_str)
        except:
            cuisine_types = []
        
        return jsonify({
            'cuisine_types': cuisine_types,
            'status': 'success'
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting cuisine types: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e),
            'status': 'error'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'status': 'error'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'status': 'error'
    }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    print("🍽️ Starting TableReserve Restaurant AI Agent API...")
    print(f"📡 API will be available at: http://localhost:{port}")
    print("📋 Available endpoints:")
    print("  POST /api/chat - Send messages to the AI agent")
    print("  POST /api/chat/reset - Reset chat history")
    print("  GET  /api/chat/history - Get chat history")
    print("  GET  /api/restaurants/cuisines - Get available cuisine types")
    print("  GET  /api/health - Health check")
    print("-" * 50)
    
    app.run(host='0.0.0.0', port=port, debug=debug) 