from flask import Flask, render_template
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os

from flask_cors import CORS # Import the CORS extension

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

# ----------------------------------------------------
# Configure CORS with specific resource mapping
# ----------------------------------------------------
CORS (
    app, 
    # This configuration applies to ALL routes EXCEPT those explicitly excluded.
    # Here I defined a default restrictive policy and overrode it for '/status'.
    resources={
        # Protect ALL routes (e.g., '/', '/api/data', '/game', etc.) 
        # by only allowing the Vercel origin.
        r"/*": {"origins": os.getenv("VERCEL_FRONTEND_URL")},
        
        # EXPLICITLY allow the /status route to be accessed from ANY origin.
        # This overrides the global '/*' rule for this specific path.
        r"/api/status": {"origins": "*"}
    },
    
    # Ensure credentials (like cookies/sessions, if used) are included
    supports_credentials=True 
)

# Define a route for the homepage
@app.route('/')
def index():
    # Flask looks in the 'templates' folder for this file
    return render_template('index.html')

# Optional: A simple API endpoint to check server status
# This route will have the CORS header set to Access-Control-Allow-Origin: <*> "ALLOW ALL"
@app.route('/api/status')
def api_status():
    return {'status': 'Flask service is running', 'version': '1.0'}

# This route (and all others defined below) will have the 
# CORS header set to Access-Control-Allow-Origin: <VERCEL_FRONTEND_URL>
@app.route('/api/getMoviesData')
def get_movies_data():
    db = client['sample_mflix']
    collection = db['movies']
    
    # Fetch a limited number of movie documents
    movies = list(collection.find().limit(10))
    
    # Convert ObjectId to string for JSON serialization
    for movie in movies:
        movie['_id'] = str(movie['_id'])
    
    return {'movies': movies}

if __name__ == '__main__':
    app.run(debug=True)
    