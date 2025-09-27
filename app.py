from flask import Flask, render_template

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
    