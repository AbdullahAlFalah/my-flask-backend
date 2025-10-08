from functools import wraps
from flask import Flask, jsonify, render_template, request
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from pymongo import DESCENDING
from datetime import datetime
from bson import ObjectId
from dotenv import load_dotenv
import os

from flask_cors import CORS, cross_origin # Import the CORS extension

# Load environment variables from .env
load_dotenv()

# Get URI from environment variables
uri = os.getenv("MONGODB_URI")

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

# Create the Flask application instance
app = Flask(__name__)

# Initialize CORS globally for decorated and non-decorated routes
CORS (app)

# ==========================================================
# UNIVERSAL ERROR HANDLER DECORATOR
# ==========================================================
def handle_errors(f):
    """Wraps any route to catch unexpected exceptions and return JSON errors."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            print(f"❌ Error in route {f.__name__}: {str(e)}")
            return jsonify({"error": str(e)}), 500
    return decorated_function

# ==========================================================
# NEW SERVER-SIDE SECURITY DECORATOR
# ==========================================================
def secure_route(f):
    """
    Decorator that checks the Origin or Referer header to ensure the request 
    is coming from the authorized Vercel frontend domain.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. Get the Origin (for API/AJAX calls) or Referer (for direct links/forms)
        origin = request.headers.get('Origin')
        referer = request.headers.get('Referer')
        
        # 2. Check for a trusted source
        is_trusted = False
        
        # Check Origin header (used by fetch/XHR)
        if origin and origin == os.getenv("VERCEL_FRONTEND_URL"):
            is_trusted = True
            
        # Check Referer header (used by regular browser navigations)
        # Note: We use .startswith() because the Referer includes the full path.
        if referer and referer.startswith(os.getenv("VERCEL_FRONTEND_URL")):
            is_trusted = True

        # 3. If the source is NOT trusted, block the request
        if not is_trusted:
            # We allow internal health checks (requests without Origin or Referer) 
            # if they are accessing a non-sensitive route like '/status'.
            # For this restricted route, we are strict.
            # You can customize the response code (403 Forbidden is common).
            return jsonify({"error": "Access Denied"}), 403
            
        # 4. If trusted, proceed with the original function
        return f(*args, **kwargs)
        
    return decorated_function

# Define a route for the homepage
@app.route('/')
def index():
    # This route is NOT decorated, so it has an unrestricted Access-Control-Allow-Origin
    # Flask looks in the 'templates' folder for this file
    return render_template('index.html')

# Optional: A simple API endpoint to check server status
@app.route('/api/status')
@handle_errors
def api_status():
    # This route is NOT decorated, so it has an unrestricted Access-Control-Allow-Origin
    return {'status': 'Flask service is running', 'version': '1.0'}

# This route (and all others defined below) will have the full security checks:
# CORS header set to Access-Control-Allow-Origin: <VERCEL_FRONTEND_URL>
# Use the CORS decorator to enforce browser security (prevents malicious scripts)
# Use the secure_route decorator to enforce server security (prevents direct access)

# ==========================================================
# GET MOVIES
# ==========================================================
@app.route('/api/getMoviesData', methods=['GET'])
@cross_origin(origins=os.getenv("VERCEL_FRONTEND_URL"), supports_credentials=True)
@secure_route
@handle_errors
def get_movies_data():
    db = client['sample_mflix']
    collection = db['movies']
    
    # Fetch a limited number of movie documents without the fullplot field
    movies = list(collection.find({}, projection={'fullplot': False}).limit(10))
    
    # Convert ObjectId to string for JSON serialization
    for movie in movies:
        movie['_id'] = str(movie['_id'])
    
    return jsonify({'movies': movies}), 200 # Success


# ==========================================================
# GET COMMENTS (Sorted by newest first)
# ==========================================================
@app.route('/api/getCommentsData', methods=['GET'])
@cross_origin(origins=os.getenv("VERCEL_FRONTEND_URL"), supports_credentials=True)
@secure_route
@handle_errors
def get_comments_data():
    db = client['sample_mflix']
    collection = db['comments']

    # Fetch a limited number of comment documents
    comments = list(collection.find().sort("date", DESCENDING).limit(10))

    # Convert ObjectId to string for JSON serialization
    for comment in comments:
        comment['_id'] = str(comment['_id'])
        comment['movie_id'] = str(comment['movie_id'])
        # Convert datetime to ISO format
        if isinstance(comment['date'], datetime):
            comment['date'] = comment['date'].isoformat()
    
    return jsonify({"comments": comments}), 200 # Success

# ==========================================================
# POST A COMMENT
# ==========================================================
@app.route('/api/addComment', methods=['POST'])
@cross_origin(origins=os.getenv("VERCEL_FRONTEND_URL"), supports_credentials=True)
@secure_route
@handle_errors
def add_comment():
    db = client['sample_mflix']
    collection = db['comments']

    data = request.get_json()

    # Validate required fields
    required_fields = ['name', 'email', 'text', 'movie_id']
    if not all(field in data and data[field] for field in required_fields):
        return jsonify({"error": "Missing one or more required fields"}), 400 # 400 Bad Request

    # Create the new comment document
    new_comment = {
        "name": data['name'],
        "email": data['email'],
        "text": data['text'],
        "movie_id": ObjectId(data['movie_id']),  # must be valid ObjectId
        "date": datetime.utcnow()
    }

    result = collection.insert_one(new_comment)

    return jsonify({
        "message": "Comment added successfully!",
        "inserted_id": str(result.inserted_id)
    }), 201 # 201 Created

if __name__ == '__main__':
    app.run(debug=True)
    