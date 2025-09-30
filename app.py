from flask import Flask, render_template
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os

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

# Define a route for the homepage
@app.route('/')
def index():
    # Flask looks in the 'templates' folder for this file
    return render_template('index.html')

# Optional: A simple API endpoint (even though you'll use FastAPI later)
@app.route('/api/status')
def api_status():
    return {'status': 'Flask service is running', 'version': '1.0'}

if __name__ == '__main__':
    app.run(debug=True)
    