from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import sys
import os
import json
import base64
import io
from datetime import datetime
import uuid
import logging

# Import your existing modules from main.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import (
    init_supabase, ObservationExtractor, upload_file_to_storage,
    supabase, genai, assemblyai_key
)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize components
try:
    extractor = ObservationExtractor()
    logger.info("ObservationExtractor initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize ObservationExtractor: {e}")
    extractor = None


# Serve HTML frontend
@app.route('/')
def index():
    """Serve the main HTML page"""
    try:
        return send_file('index.html')
    except FileNotFoundError:
        return jsonify({
            'error': 'Frontend files not found',
            'message': 'Please ensure index.html is in the same directory as app.py'
        }), 404


@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS, images)"""
    try:
        return send_from_directory('.', filename)
    except FileNotFoundError:
        return jsonify({'error': f'File {filename} not found'}), 404


# API Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'supabase_connected': supabase is not None,
        'extractor_ready': extractor is not None
    })


@app.route('/api/login', methods=['POST'])
def login():
    """Handle user login"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400

        # Check admin login
        if email == "admin" and password == "hello":
            return jsonify({
                'success': True,
                'user': {
                    'id': 'admin',
                    'name': 'Admin',
                    'role': 'Admin',
                    'email': email
                }
            })

        # Check regular user login
        user_response = supabase.table('users').select("*").eq("email", email).eq("password", password).execute()

        if user_response.data:
            user = user_response.data[0]
            return jsonify({
                'success': True,
                'user': {
                    'id': user['id'],
                    'name': user.get('name', 'User'),
                    'role': user['role'],
                    'email': user['email'],
                    'child_id': user.get('child_id')
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'success': False, 'message': 'Login failed due to server error'}), 500


@app.route('/api/register', methods=['POST'])
def register():
    """Handle user registration"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        required_fields = ['name', 'email', 'role', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'{field.title()} is required'}), 400

        # Check if email exists
        existing = supabase.table('users').select("email").eq("email", data['email']).execute()

        if existing.data:
            return jsonify({'success': False, 'message': 'Email already registered'}), 409

        # Create new user
        user_data = {
            "id": str(uuid.uuid4()),
            "email": data['email'].strip().lower(),
            "name": data['name'].strip(),
            "password": data['password'],
            "role": data['role']
        }

        if data['role'] == 'Parent' and data.get('child_id'):
            user_data['child_id'] = data['child_id']

        result = supabase.table('users').insert(user_data).execute()

        if result.data:
            return jsonify({'success': True, 'message': 'Account created successfully'})
        else:
            return jsonify({'success': False, 'message': 'Registration failed'}), 500

    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'success': False, 'message': 'Registration failed due to server error'}), 500


@app.route('/api/children', methods=['GET'])
def get_children():
    """Get list of children for parent selection"""
    try:
        children = supabase.table('children').select("*").execute().data
        return jsonify({'success': True, 'children': children})
    except Exception as e:
        logger.error(f"Error fetching children: {e}")
        return jsonify({'success': False, 'message': 'Failed to fetch children'}), 500


@app.route('/api/observer/children', methods=['GET'])
def get_observer_children():
    """Get children assigned to observer"""
    try:
        observer_id = request.args.get('observer_id')
        if not observer_id:
            return jsonify({'success': False, 'message': 'Observer ID is required'}), 400

        mappings = supabase.table('observer_child_mappings').select("child_id").eq("observer_id",
                                                                                   observer_id).execute().data
        child_ids = [m['child_id'] for m in mappings]

        if child_ids:
            children = supabase.table('children').select("*").in_("id", child_ids).execute().data
            return jsonify({'success': True, 'children': children})
        else:
            return jsonify({'success': True, 'children': []})

    except Exception as e:
        logger.error(f"Error fetching observer children: {e}")
        return jsonify({'success': False, 'message': 'Failed to fetch assigned children'}), 500


@app.route('/api/process-image', methods=['POST'])
def process_image():
    """Process uploaded observation image"""
    try:
        if not extractor:
            return jsonify({'success': False, 'message': 'Image processing service unavailable'}), 503

        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        required_fields = ['image', 'child_id', 'observer_id', 'session_info']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'{field} is required'}), 400

        image_data = data['image']
        child_id = data['child_id']
        observer_id = data['observer_id']
        session_info = data['session_info']

        # Validate base64 image
        if ',' not in image_data:
            return jsonify({'success': False, 'message': 'Invalid image format'}), 400

        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1])
        except Exception:
            return jsonify({'success': False, 'message': 'Failed to decode image'}), 400

        # Create a file-like object
        class ImageFile:
            def __init__(self, data, name):
                self.data = data
                self.name = name
                self.type = "image/jpeg"

            def read(self):
                return self.data

            def seek(self, pos):
                pass

        image_file = ImageFile(image_bytes, "observation.jpg")

        # Process with OCR
        extracted_text = extractor.extract_text_with_ocr(image_file)
        structured_data = extractor.process_with_groq(extracted_text)
        observations_text = structured_data.get("observations", "")

        if observations_text:
            # Generate report
            report = extractor.generate_report_from_text(observations_text, session_info)

            # Save to database
            observation_response = supabase.table('observations').insert({
                "student_id": child_id,
                "username": observer_id,
                "student_name": structured_data.get("studentName", session_info['student_name']),
                "observer_name": session_info['observer_name'],
                "class_name": structured_data.get("className", ""),
                "date": structured_data.get("date", session_info['session_date']),
                "observations": observations_text,
                "strengths": json.dumps(structured_data.get("strengths", [])),
                "areas_of_development": json.dumps(structured_data.get("areasOfDevelopment", [])),
                "recommendations": json.dumps(structured_data.get("recommendations", [])),
                "timestamp": datetime.now().isoformat(),
                "filename": "observation.jpg",
                "full_data": json.dumps(structured_data),
                "theme_of_day": structured_data.get("themeOfDay", ""),
                "curiosity_seed": structured_data.get("curiositySeed", "")
            }).execute()

            return jsonify({
                'success': True,
                'report': report,
                'message': 'Image processed successfully'
            })
        else:
            return jsonify({'success': False, 'message': 'No observations found in image'}), 400

    except Exception as e:
        logger.error(f"Image processing error: {e}")
        return jsonify({'success': False, 'message': 'Image processing failed'}), 500


@app.route('/api/process-audio', methods=['POST'])
def process_audio():
    """Process uploaded audio recording"""
    try:
        if not extractor:
            return jsonify({'success': False, 'message': 'Audio processing service unavailable'}), 503

        if 'audio' not in request.files:
            return jsonify({'success': False, 'message': 'No audio file provided'}), 400

        audio_file = request.files['audio']
        child_id = request.form.get('child_id')
        observer_id = request.form.get('observer_id')
        session_info_str = request.form.get('session_info')

        if not all([child_id, observer_id, session_info_str]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400

        try:
            session_info = json.loads(session_info_str)
        except json.JSONDecodeError:
            return jsonify({'success': False, 'message': 'Invalid session info format'}), 400

        # Transcribe audio
        transcript = extractor.transcribe_with_assemblyai(audio_file)

        if "Error" in transcript:
            return jsonify({'success': False, 'message': transcript}), 400

        # Generate report
        report = extractor.generate_report_from_text(transcript, session_info)

        # Save to database
        supabase.table('observations').insert({
            "student_id": child_id,
            "username": observer_id,
            "student_name": session_info['student_name'],
            "observer_name": session_info['observer_name'],
            "class_name": "",
            "date": session_info['session_date'],
            "observations": transcript,
            "strengths": json.dumps([]),
            "areas_of_development": json.dumps([]),
            "recommendations": json.dumps([]),
            "timestamp": datetime.now().isoformat(),
            "filename": audio_file.filename,
            "full_data": json.dumps({"transcript": transcript, "report": report})
        }).execute()

        return jsonify({
            'success': True,
            'report': report,
            'transcript': transcript,
            'message': 'Audio processed successfully'
        })

    except Exception as e:
        logger.error(f"Audio processing error: {e}")
        return jsonify({'success': False, 'message': 'Audio processing failed'}), 500


@app.route('/api/reports', methods=['GET'])
def get_reports():
    """Get reports for a child"""
    try:
        child_id = request.args.get('child_id')
        if not child_id:
            return jsonify({'success': False, 'message': 'Child ID is required'}), 400

        reports = supabase.table('observations').select("*").eq("student_id", child_id).order('date',
                                                                                              desc=True).execute().data
        return jsonify({'success': True, 'reports': reports})
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        return jsonify({'success': False, 'message': 'Failed to fetch reports'}), 500


@app.route('/api/send-email', methods=['POST'])
def send_email():
    """Send report via email"""
    try:
        if not extractor:
            return jsonify({'success': False, 'message': 'Email service unavailable'}), 503

        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        required_fields = ['email', 'subject', 'content']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'{field} is required'}), 400

        success, message = extractor.send_email(
            data['email'],
            data['subject'],
            data['content']
        )
        return jsonify({'success': success, 'message': message})
    except Exception as e:
        logger.error(f"Email sending error: {e}")
        return jsonify({'success': False, 'message': 'Failed to send email'}), 500


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': 'Method not allowed'}), 405


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Check if required files exist
    required_files = ['index.html', 'style.css', 'script.js']
    missing_files = [f for f in required_files if not os.path.exists(f)]

    if missing_files:
        logger.warning(f"Missing frontend files: {missing_files}")
        logger.info("Frontend will not be available until these files are created")

    logger.info("Starting Flask server...")
    logger.info("Frontend will be available at: http://127.0.0.1:5000")
    logger.info("API endpoints available at: http://127.0.0.1:5000/api/")

    app.run(debug=True, port=5000, host='127.0.0.1')
