import os
import io
import base64
import json
import uuid
import calendar
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from dotenv import load_dotenv
import requests

# Load .env
load_dotenv()

# Flask setup
app = Flask(__name__)
CORS(app)
app.secret_key = os.environ.get("SECRET_KEY", "dev")

# Secrets
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
ASSEMBLYAI_API_KEY = os.environ.get("ASSEMBLYAI_API_KEY")
OCR_API_KEY = os.environ.get("OCR_API_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD")
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "hello")

# External services
from supabase import create_client
import google.generativeai as genai
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GOOGLE_API_KEY)

# --- Helper Classes ---
class ObservationExtractor:
    def __init__(self):
        self.ocr_api_key = OCR_API_KEY
        self.groq_api_key = GROQ_API_KEY
        self.gemini_api_key = GOOGLE_API_KEY

    def extract_text_with_ocr(self, image_file):
        file_type = image_file.filename.split('.')[-1].lower()
        if file_type == 'jpeg':
            file_type = 'jpg'
        base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        base64_image_with_prefix = f"data:image/{file_type};base64,{base64_image}"
        payload = {
            'apikey': self.ocr_api_key,
            'language': 'eng',
            'isOverlayRequired': False,
            'OCREngine': 2,
            'detectOrientation': True,
            'scale': True,
            'base64Image': base64_image_with_prefix
        }
        response = requests.post(
            'https://api.ocr.space/parse/image',
            data=payload,
            headers={'apikey': self.ocr_api_key}
        )
        response.raise_for_status()
        data = response.json()
        if not data.get('ParsedResults'):
            raise Exception(f"OCR Error: {data.get('ErrorMessage', 'No parsed results returned')}")
        parsed_result = data['ParsedResults'][0]
        if parsed_result.get('ErrorMessage'):
            raise Exception(f"OCR Error: {parsed_result['ErrorMessage']}")
        extracted_text = parsed_result['ParsedText']
        if not extracted_text or not extracted_text.strip():
            raise Exception("No text was detected in the image")
        return extracted_text

    def process_with_groq(self, extracted_text):
        system_prompt = """You are an AI assistant for a learning observation system. Extract and structure information from the provided observation sheet text.
        Format your response as JSON with the following structure:
        {
          "studentName": "...",
          "studentId": "...",
          "className": "...",
          "date": "...",
          "observations": "...",
          "strengths": [],
          "areasOfDevelopment": [],
          "recommendations": []
        }"""
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {self.groq_api_key}',
                'Content-Type': 'application/json'
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract and structure: {extracted_text}"}
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"}
            }
        )
        response.raise_for_status()
        ai_response = response.json()['choices'][0]['message']['content']
        return json.loads(ai_response)

    def transcribe_with_assemblyai(self, audio_file):
        headers = {"authorization": ASSEMBLYAI_API_KEY}
        upload_response = requests.post(
            "https://api.assemblyai.com/v2/upload",
            headers=headers,
            data=audio_file.read()
        )
        if upload_response.status_code != 200:
            return f"Error uploading audio: {upload_response.text}"
        upload_url = upload_response.json()["upload_url"]
        transcript_request = {
            "audio_url": upload_url,
            "language_code": "en"
        }
        transcript_response = requests.post(
            "https://api.assemblyai.com/v2/transcript",
            json=transcript_request,
            headers=headers
        )
        if transcript_response.status_code != 200:
            return f"Error requesting transcription: {transcript_response.text}"
        transcript_id = transcript_response.json()["id"]
        status = "processing"
        while status != "completed" and status != "error":
            polling_response = requests.get(
                f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                headers=headers
            )
            polling_data = polling_response.json()
            status = polling_data["status"]
            if status == "completed":
                return polling_data["text"]
            elif status == "error":
                return f"Transcription error: {polling_data.get('error', 'Unknown error')}"
            import time; time.sleep(2)
        return "Error: Transcription timed out or failed."

    def generate_report_from_text(self, text_content, user_info):
        prompt = f"""
        Based on this text from a student observation, create a detailed observer report following the new Daily Growth Report format.

        TEXT CONTENT:
        {text_content}

        FORMAT REQUIREMENTS:
        🧾 Daily Growth Report Format for Parents
        🧒 Child's Name: {user_info['student_name']}
        📅 Date: [{user_info['session_date']}]
        ...
        Use the exact section titles, emojis and format as above. For items that cannot be determined from the text, make reasonable inferences based on the available information.
        """
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content([{"role": "user", "parts": [{"text": prompt}]}])
        return response.text

    def send_email(self, recipient_email, subject, message):
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        sender_email = "parth.workforai@gmail.com"
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = recipient_email
        msg["Subject"] = subject
        msg.attach(MIMEText(message, "html"))
        try:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(sender_email, EMAIL_PASSWORD)
            server.send_message(msg)
            return True, f"Email sent to {recipient_email}"
        except Exception as e:
            return False, f"Error: {str(e)}"
        finally:
            try: server.quit()
            except: pass

extractor = ObservationExtractor()

# --- Frontend routes ---
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    if os.path.exists(filename):
        return send_from_directory('.', filename)
    abort(404)

# --- API Endpoints ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    if email == ADMIN_USER and password == ADMIN_PASS:
        return jsonify({"success": True, "user": {"id": "admin", "name": "Admin", "role": "Admin", "email": email}})
    user_response = supabase.table('users').select("*").eq("email", email).eq("password", password).execute()
    if user_response.data:
        user = user_response.data[0]
        return jsonify({"success": True, "user": {
            "id": user['id'],
            "name": user.get('name', 'User'),
            "role": user['role'],
            "email": user['email'],
            "child_id": user.get('child_id')
        }})
    return jsonify({"success": False, "message": "Wrong email or password"}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data['email'].strip().lower()
    existing = supabase.table('users').select("email").eq("email", email).execute()
    if existing.data:
        return jsonify({'success': False, 'message': 'Email already registered'}), 409
    user_data = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": data['name'],
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

@app.route('/api/children', methods=['GET'])
def get_children():
    children = supabase.table('children').select("*").execute().data
    return jsonify({'success': True, 'children': children})

@app.route('/api/observer/children', methods=['GET'])
def get_observer_children():
    observer_id = request.args.get('observer_id')
    mappings = supabase.table('observer_child_mappings').select("child_id").eq("observer_id", observer_id).execute().data
    child_ids = [m['child_id'] for m in mappings]
    if child_ids:
        children = supabase.table('children').select("*").in_("id", child_ids).execute().data
        return jsonify({'success': True, 'children': children})
    else:
        return jsonify({'success': True, 'children': []})

@app.route('/api/process-image', methods=['POST'])
def process_image():
    data = request.json
    image_data = data['image']
    child_id = data['child_id']
    observer_id = data['observer_id']
    session_info = data['session_info']
    image_bytes = base64.b64decode(image_data.split(',')[1])
    image_file = io.BytesIO(image_bytes)
    image_file.filename = "observation.jpg"
    extracted_text = extractor.extract_text_with_ocr(image_file)
    structured_data = extractor.process_with_groq(extracted_text)
    observations_text = structured_data.get("observations", "")
    report = extractor.generate_report_from_text(observations_text, session_info)
    supabase.table('observations').insert({
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
    return jsonify({'success': True, 'report': report})

@app.route('/api/process-audio', methods=['POST'])
def process_audio():
    audio_file = request.files['audio']
    child_id = request.form.get('child_id')
    observer_id = request.form.get('observer_id')
    session_info = json.loads(request.form.get('session_info'))
    transcript = extractor.transcribe_with_assemblyai(audio_file)
    report = extractor.generate_report_from_text(transcript, session_info)
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
    return jsonify({'success': True, 'report': report, 'transcript': transcript})

@app.route('/api/reports', methods=['GET'])
def get_reports():
    child_id = request.args.get('child_id')
    reports = supabase.table('observations').select("*").eq("student_id", child_id).order('date', desc=True).execute().data
    return jsonify({'success': True, 'reports': reports})

@app.route('/api/send-email', methods=['POST'])
def send_email():
    data = request.json
    success, message = extractor.send_email(data['email'], data['subject'], data['content'])
    return jsonify({'success': success, 'message': message})

@app.route('/api/monthly-report', methods=['POST'])
def monthly_report():
    data = request.json
    child_id = data['child_id']
    year = int(data['year'])
    month = int(data['month'])
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year+1}-01-01"
    else:
        end_date = f"{year}-{month+1:02d}-01"
    observations = supabase.table('observations').select("*") \
        .eq("student_id", child_id) \
        .gte("date", start_date) \
        .lt("date", end_date) \
        .execute().data
    strength_counts = {}
    for obs in observations:
        if obs.get('strengths'):
            strengths = json.loads(obs['strengths']) if isinstance(obs['strengths'], str) else obs['strengths']
            for strength in strengths:
                strength_counts[strength] = strength_counts.get(strength, 0) + 1
    dev_counts = {}
    for obs in observations:
        if obs.get('areas_of_development'):
            areas = json.loads(obs['areas_of_development']) if isinstance(obs['areas_of_development'], str) else obs['areas_of_development']
            for area in areas:
                dev_counts[area] = dev_counts.get(area, 0) + 1
    summary = {
        "total_observations": len(observations),
        "key_strengths": list(strength_counts.keys())[:5],
        "areas_for_development": list(dev_counts.keys())[:5],
        "month_name": calendar.month_name[month],
        "year": year,
        "student_name": observations[0]['student_name'] if observations else "",
        "observer_name": observations[0]['observer_name'] if observations else "",
        "average_rating": 0  # Placeholder, implement as needed
    }
    return jsonify({'success': True, 'report': summary})

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    users_count = len(supabase.table('users').select("id").execute().data or [])
    children_count = len(supabase.table('children').select("id").execute().data or [])
    reports_count = len(supabase.table('observations').select("id").execute().data or [])
    observers_count = len(supabase.table('users').select("id").eq("role", "Observer").execute().data or [])
    return jsonify({
        "success": True,
        "stats": {
            "total_users": users_count,
            "total_children": children_count,
            "total_reports": reports_count,
            "active_observers": observers_count
        }
    })

@app.route('/api/admin/users', methods=['GET'])
def admin_users():
    users = supabase.table('users').select("*").execute().data
    return jsonify({"success": True, "users": users})

# --- Error handlers ---
@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "error": "Not Found"}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)
