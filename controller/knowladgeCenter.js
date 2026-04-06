const https = require('https');

async function generateResponse(prompt) {
    
    let input = {
        contents: [
            {
                parts: [
                    { text: prompt }
                ]
            }
        ]
    };
    const apiKey = 'AIzaSyCTNl1MAitLPrugoXLLYextgJ8jSLulndc'; // Replace with your actual API key
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(`${endpoint}?key=${apiKey}`, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(JSON.stringify(input));  // Send JSON stringified input
        req.end();
    });
}
const hypotheticalQuestion = {
    "who_are_you": {
      "questions": [
        "Who are you",
        "What's your name",
        "Tell me about yourself",
        "Can you introduce yourself",
        "What do you do",
        "What is your purpose",
        "What are you"
      ],
      "answer": "I am ALIS. I am a large language model, trained by Educational Eternity. I'm a computer program designed to process information and respond to a wide range of prompts and questions in a human-like way."
    },
    "who_created_you": {
      "questions": [
        "Who created you",
        "Who made you",
        "Who built you",
        "Who developed you",
        "Who is your developer",
        "Who is your creator",
        "Who coded you"
      ],
      "answer": "I am built by Prashant Raj."
    },
    "what_is_your_name": {
      "questions": [
        "What is your name",
        "What's your name",
        "Your name",
        "May I know your name",
        "Can you tell your name",
        "Do you have a name"
      ],
      "answer": "I am ALIS. I am a large language model, trained by Educational Eternity."
    }
  }
  
// Example usage
const knowladgeCenter = async (req, res, next) => {
    try {
        let question = req.body.question;
        question =  question.toLowerCase().replace(/[?.!,]/g, '').trim();
       ///////////////////////////////////////
       const normalizedInput = question.trim().toLowerCase();

       for (const key in hypotheticalQuestion) {
         const qSet = hypotheticalQuestion[key].questions;
         for (const q of qSet) {
           if (normalizedInput === q.trim().toLowerCase() || normalizedInput.includes(q.trim().toLowerCase()) || q.trim().toLowerCase().includes(normalizedInput)) {
            return res.status(200).json({
                success: true,
                message: "Response generated successfully",
                code: 200,
                data:hypotheticalQuestion[key].answer});
           }
         }
       }

       /////////////////////////////////////////
        const response = await generateResponse(question);
       // console.log('Gemini API Response:', JSON.stringify(response, null, 2));

        if (response.candidates && response.candidates.length > 0) {
            const generatedText = response.candidates[0].content.parts[0].text;
            res.status(200).json({
                success: true,
                message: "Response generated successfully",
                code: 200,
                data:generatedText});
        } else {
            res.json({  
                success: false,
                message: 'An error occurred!',
                code: 500,
                error:  "No text generated" 
            });
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = {
    knowladgeCenter
};
