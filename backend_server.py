from flask import Flask, request, jsonify
from flask_cors import CORS
import PyPDF2
import io
import google.generativeai as genai
import os
import json # Import json module for parsing AI response

app = Flask(__name__)
CORS(app) # Enable CORS for your frontend to communicate with this backend

# IMPORTANT: Set your Gemini API Key as an environment variable
# For example: export GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
# Or replace os.getenv with your actual key directly for testing (not recommended for production)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyA-4-3FTYo7yicpgD6aVhg1smciwNGnFgk") # Updated with your provided key

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY environment variable not set. AI features will not work.")
    print("Please set it using: export GEMINI_API_KEY='YOUR_API_KEY'")
    # For testing, you can uncomment the line below and replace with your key,
    # but remove it for production.
    # GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE" # <--- REPLACE THIS LINE WITH YOUR ACTUAL KEY FOR TESTING IF NOT USING ENV VARS

genai.configure(api_key=GEMINI_API_KEY)

@app.route('/extract-skills', methods=['POST','GET'])
def extract_skills():
    """
    Receives a PDF file, extracts text, and uses Gemini API to identify skills.
    """
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file provided"}), 400

    resume_file = request.files['resume']
    if resume_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not resume_file.filename.endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400

    try:
        # Read the PDF file content
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(resume_file.read()))
        text_content = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text_content += page.extract_text() or "" # Handle cases where page.extract_text() might return None

        if not text_content.strip():
            return jsonify({"error": "Could not extract text from PDF. It might be an image-based PDF or empty."}), 400

        # Use Gemini API to extract skills from the text content
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""Extract all key technical skills from the following resume text.
Focus on specific, quantifiable technical skills. Provide the output as a JSON array of strings.        
        Resume Text:
        {text_content[:10000]} 
        (Processing up to first 10000 characters to manage token limits for potentially large resumes)
        """
        
        # Define the response schema for structured output
        generation_config = {
            "response_mime_type": "application/json",
            "response_schema": {
                "type": "ARRAY",
                "items": {"type": "STRING"}
            }
        }

        response = model.generate_content(prompt, generation_config=generation_config)
        
        # Parse the JSON response
        try:
            extracted_skills = response.text
            # Ensure the response is a valid JSON array string, then parse it
            if isinstance(extracted_skills, str):
                skills_list = json.loads(extracted_skills)
                if not isinstance(skills_list, list):
                    raise ValueError("AI response is not a JSON array.")
            else:
                skills_list = [] # Fallback if response.text is not a string
            
            return jsonify({"skills": skills_list}), 200
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from Gemini: {e}")
            print(f"Gemini raw response: {response.text}")
            return jsonify({"error": "Failed to parse skills from AI response. Raw response: " + response.text}), 500
        except Exception as e:
            print(f"Unexpected error processing AI response: {e}")
            return jsonify({"error": f"An unexpected error occurred during AI processing: {str(e)}"}), 500

    except PyPDF2.errors.PdfReadError:
        return jsonify({"error": "Invalid PDF file. Could not read."}), 400
    except Exception as e:
        print(f"Server error: {e}")
        return jsonify({"error": f"An unexpected server error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    # For local development, run on port 5000.
    # Ensure your frontend fetches from this URL.
    app.run(debug=True, port=5000, host='0.0.0.0')

