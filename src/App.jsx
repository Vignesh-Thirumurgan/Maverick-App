import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot, collection, getDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { Home, User, Target, Brain, Award, Users, LogOut, Edit, BarChart, BookOpen, MessageSquare, UploadCloud, XCircle, Settings, Search, BriefcaseBusiness, TrendingUp, Lightbulb, ClipboardList, Send, PlusCircle, Play, CircleStop } from 'lucide-react';
import {UserCheck,Eye, X } from 'lucide-react';
import confetti from 'canvas-confetti'; // This line must be present
import { LoginPage } from './components/LoginPage'; // Adjust path if you placed it elsewhere
// Import common UI components from the new file
import { Button, Input, Textarea, Select, MessageBox, LoadingPage, ProgressBar } from './components/common/UIComponents.jsx';

// Import useFirebase hook from its dedicated file
import { useFirebase } from './hooks/useFirebaseHook.jsx';

import { GoogleGenerativeAI } from '@google/generative-ai';
// Import Recharts components for Radar Chart
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from 'recharts';
import UserDetailsModal from './components/UserDetailsModal.jsx';


// --- Auth Page ---
const Auth = ({ setCurrentPage, onAuthSuccessAndMessageDismissed }) => {
    const { auth, db, appId } = useFirebase();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [showMessageBox, setShowMessageBox] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setShowMessageBox(false);

        try {
            if (isLogin) {
                // Login
                await signInWithEmailAndPassword(auth, email, password);
                setMessage('Login successful!');
                setMessageType('success');
                setShowMessageBox(true);
                // The useEffect in App.jsx will handle redirection after login
            } else {
                // Register
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Corrected path: Create a basic profile document for the new user in the 'data' document
                const userProfileDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);
                await setDoc(userProfileDocRef, {
                    email: user.email,
                    userType: 'employee', // Default new users to 'employee'
                    fullName: '',
                    workflowProgress: 0,
                    points: 0,
                    skills: [],
                    completedModules: [],
                    assessments: [],
                    targetRole: '',
                });

                setMessage('Registration successful! Please set up your profile.');
                setMessageType('success');
                setShowMessageBox(true);
                // Call the callback to inform App.jsx to go to profile setup
                onAuthSuccessAndMessageDismissed();
            }
        } catch (error) {
            console.error("Authentication error:", error);
            setMessage(`Authentication failed: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700 w-full max-w-md">
                <h1 className="text-4xl font-extrabold text-center mb-8 text-blue-400">Maverick</h1>
                <h2 className="text-2xl font-bold text-center mb-6 text-gray-200">
                    {isLogin ? 'Login' : 'Register'}
                </h2>
                <form onSubmit={handleAuth} className="space-y-6">
                    <Input
                        id="email"
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@example.com"
                        required
                    />
                    <Input
                        id="password"
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        required
                    />
                    <Button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700">
                        {isLoading ? (isLogin ? 'Logging In...' : 'Registering...') : (isLogin ? 'Login' : 'Register')}
                    </Button>
                </form>
                <p className="mt-6 text-center text-gray-400">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-blue-400 hover:text-blue-300 font-medium transition duration-200"
                    >
                        {isLogin ? 'Register here' : 'Login here'}
                    </button>
                </p>
            </div>
            {showMessageBox && (
                <MessageBox
                    message={message}
                    type={messageType}
                    onConfirm={() => {
                        setShowMessageBox(false);
                        if (messageType === 'success' && !isLogin) {
                            // If registration was successful, call the callback to proceed
                            onAuthSuccessAndMessageDismissed();
                        }
                    }}
                />
            )}
        </div>
    );
};

// --- Profile Setup Page ---
const ProfileSetup = ({ setCurrentPage }) => {
    const { userId, db, isAuthReady, appId } = useFirebase();
    const [fullName, setFullName] = useState('');
    const [targetRole, setTargetRole] = useState('');
    // Skills now stored as an array of objects { name: string, level: number }
    const [skills, setSkills] = useState([]);; // Added semicolon here
    const [resumeFile, setResumeFile] = useState(null); // State for the selected resume file
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [showMessageBox, setShowMessageBox] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // For initial profile load
    const [isProcessingResume, setIsProcessingResume] = useState(false); // For resume extraction

    useEffect(() => {
        if (isAuthReady && !userId) {
            setCurrentPage('auth');
            return;
        }

        if (isAuthReady && userId) {
            const userProfileDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
            const unsubscribe = onSnapshot(userProfileDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFullName(data?.fullName || '');
                    setTargetRole(data?.targetRole || '');
                    // Ensure skills are an array of objects with name and level
                    // Handle cases where skills might be stored as an array of strings (old format)
                    setSkills(data?.skills && Array.isArray(data.skills)
                        ? data.skills.map(s => typeof s === 'string' ? { name: s, level: 0 } : s)
                        : []
                    );
                } else {
                    console.log("No profile data found, starting fresh setup.");
                    setFullName('');
                    setTargetRole('');
                    setSkills([]); // Start with an empty array
                }
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching profile for setup:", error);
                setMessage('Failed to load existing profile data.');
                setMessageType('error');
                setShowMessageBox(true);
                setIsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [isAuthReady, userId, db, setCurrentPage, appId]);

    // Function to handle file selection
    const handleFileChange = (event) => {
        setResumeFile(event.target.files[0]);
    };

    // Function to handle skill extraction via backend
    const handleExtractSkills = async () => {
        if (!resumeFile) {
            setMessage('Please select a PDF resume file first.');
            setMessageType('warning');
            setShowMessageBox(true);
            return;
        }

        setIsProcessingResume(true); // Set loading for resume processing
        setMessage('Extracting skills from resume...');
        setMessageType('info');
        setShowMessageBox(true);

        const formData = new FormData();
        formData.append('resume', resumeFile);

        try {
            // IMPORTANT: Replace with the actual URL where your Flask backend is running
            const backendUrl = `${import.meta.env.VITE_BACKEND_URL}/extract-skills`;

            const response = await fetch(backendUrl, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                // Assuming the backend returns { "skills": ["skill1", "skill2"] }
                const extractedSkillNames = data.skills;
                
                const mergedSkills = [...skills]; // Start with current skills
                extractedSkillNames.forEach(newSkillName => {
                    // Check if the skill already exists (case-insensitive)
                    const existingSkillIndex = mergedSkills.findIndex(s => s.name.toLowerCase() === newSkillName.toLowerCase());
                    if (existingSkillIndex === -1) {
                        // If new, add it with a default level (e.g., 0 or 1)
                        mergedSkills.push({ name: newSkillName, level: 0 }); 
                    }
                    // If it exists, we keep its current level, no need to update from extraction
                });
                setSkills(mergedSkills);
                setMessage('Skills extracted successfully! Review and save your profile.');
                setMessageType('success');
            } else {
                setMessage(`Error extracting skills: ${data.error || 'Unknown error'}`);
                setMessageType('error');
            }
        } catch (error) {
            console.error('Error sending file to backend:', error);
            setMessage('Network error or server unavailable. Please ensure your backend is running.');
            setMessageType('error');
        } finally {
            setIsProcessingResume(false); // End loading for resume processing
            setShowMessageBox(true);
        }
    };

    // Function to handle manual skill addition
    const addManualSkill = () => {
        setSkills([...skills, { name: '', level: 0 }]); // Add a new skill object with default level 0
    };

    // Function to handle changes in manually added skills (name or level)
    const handleSkillChange = (index, field, value) => {
        const newSkills = [...skills];
        newSkills[index][field] = value;
        setSkills(newSkills);
    };

    // Function to remove a skill
    const removeSkill = (indexToRemove) => {
        setSkills(skills.filter((_, index) => index !== indexToRemove));
    };


    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!userId || !db) return;

        setIsLoading(true); // Use isLoading for saving profile
        setShowMessageBox(false);

        try {
            const userProfileDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
            await setDoc(userProfileDocRef, {
                fullName,
                targetRole,
                // Filter out skills where name is empty before saving
                skills: skills.filter(skill => skill.name.trim() !== ''),
                // Ensure other fields are merged or initialized if they don't exist
                points: 0,
                workflowProgress: 0,
                completedModules: [],
                assessments: [],
                // email: fullName, // This line is likely incorrect, email should come from auth
                // userType: 'employee' // Assuming default type
            }, { merge: true });

            setMessage('Profile saved successfully!');
            setMessageType('success');
            setShowMessageBox(true);
            setCurrentPage('dashboard');
        } catch (error) {
            console.error("Error saving profile:", error);
            setMessage(`Failed to save profile: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        } finally {
            setIsLoading(false); // End loading for saving profile
        }
    };

    if (isLoading) {
        return <LoadingPage message="Loading profile data..." />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700 w-full max-w-3xl">
                <h1 className="text-3xl font-extrabold text-center mb-6 text-blue-400">Set Up Your Profile</h1>
                <form onSubmit={handleSaveProfile} className="space-y-6">
                    <Input
                        id="fullName"
                        label="Your Full Name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g., John Doe"
                        required
                        disabled={isProcessingResume}
                    />
                    <Input
                        id="targetRole"
                        label="Your Desired Target Role"
                        type="text"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        placeholder="e.g., Senior Software Engineer, Data Scientist"
                        disabled={isProcessingResume}
                    />

                    {/* Resume Upload Section */}
                    <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Extract Skills from Resume (PDF)
                        </label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-400
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-500 file:text-white
                                hover:file:bg-blue-600
                                cursor-pointer"
                            disabled={isProcessingResume}
                        />
                        {resumeFile && (
                            <p className="text-gray-400 text-xs mt-2">Selected file: {resumeFile.name}</p>
                        )}
                        <Button
                            onClick={handleExtractSkills}
                            className="mt-4 w-full bg-blue-600 hover:bg-blue-700"
                            icon={UploadCloud}
                            disabled={isProcessingResume}
                        >
                            {isProcessingResume ? 'Extracting...' : 'Extract Skills'}
                        </Button>
                    </div>

                    {/* Display Current Skills and Manual Entry */}
                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Your Current Skill Sets
                        </label>
                        <div className="bg-gray-700 p-3 rounded-lg border border-gray-600 min-h-[80px] space-y-2">
                            {skills.length > 0 ? (
                                skills.map((skill, index) => (
                                    <div key={index} className="flex flex-col md:flex-row items-end gap-2">
                                        <Input
                                            type="text"
                                            value={skill.name} // Access skill.name
                                            onChange={(e) => handleSkillChange(index, 'name', e.target.value)}
                                            placeholder="Enter skill name"
                                            className="flex-grow"
                                            disabled={isProcessingResume}
                                        />
                                        <Select
                                            label="Level" // Label for the select
                                            value={skill.level} // Access skill.level
                                            onChange={(e) => handleSkillChange(index, 'level', parseInt(e.target.value))}
                                            options={[
                                                { value: 0, label: '0 - None' },
                                                { value: 1, label: '1 - Novice' },
                                                { value: 2, label: '2 - Beginner' },
                                                { value: 3, label: '3 - Intermediate' },
                                                { value: 4, label: '4 - Advanced' },
                                                { value: 5, label: '5 - Expert' },
                                            ]}
                                            className="w-full md:w-32" // Adjust width for the select
                                            disabled={isProcessingResume}
                                        />
                                        <Button
                                            type="button"
                                            onClick={() => removeSkill(index)}
                                            icon={XCircle}
                                            className="bg-red-600 hover:bg-red-700 text-xs"
                                            disabled={isProcessingResume}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-sm">No skills added yet. Upload a resume or manually add them.</p>
                            )}
                            <Button
                                type="button"
                                onClick={addManualSkill}
                                className="bg-green-600 hover:bg-green-700 text-sm mt-2"
                                disabled={isProcessingResume}
                            >
                                Add Manual Skill
                            </Button>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading || isProcessingResume}
                        className="w-full bg-blue-600 hover:bg-blue-700 mt-6"
                    >
                        {isLoading ? 'Saving Profile...' : 'Save Profile'}
                    </Button>
                    <Button onClick={() => setCurrentPage('dashboard')} className="w-full bg-gray-600 hover:bg-gray-700 mt-3">
                        Back to Dashboard
                    </Button>
                </form>
            </div>
            {showMessageBox && (
                <MessageBox message={message} type={messageType} onConfirm={() => setShowMessageBox(false)} />
            )}
        </div>
    );
};

// --- MaverickChatbot Component (NEW COMPONENT) ---
const MaverickChatbot = ({ setCurrentPage }) => {
    const { userId, db, isAuthReady, geminiApiKey, appId } = useFirebase();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [showMessageBox, setShowMessageBox] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        if (isAuthReady && !userId) {
            setCurrentPage('auth');
        }
    }, [isAuthReady, userId, setCurrentPage]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isThinking) return;

        const userMessage = { text: input, sender: 'user', timestamp: new Date() };
        setMessages((prevMessages) => [...prevMessages, userMessage]);
        setInput('');
        setIsThinking(true);
        setShowMessageBox(false);

        try {
            const currentChatHistory = messages.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));

            const prompt = `You are Maverick, an AI assistant for career development. Respond to the user's query regarding their career, skills, learning, or job search. Be helpful, concise, and professional. Current user query: ${input}`;

            const chatHistory = [...currentChatHistory, { role: "user", parts: [{ text: prompt }] }];
            const payload = {
                contents: chatHistory,
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                },
            };
            const geminiApiKey1="AIzaSyDCK71nmlbEL9-t_vnEEjoV9SHOSTyX0YI"  // api key 1 Joshua.

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey1}`; // Updated to gemini-1.5-flash

            let retries = 0;
            const maxRetries = 5;
            const baseDelay = 1000;

            while (retries < maxRetries) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (response.status === 429) {
                        const delay = baseDelay * Math.pow(2, retries);
                        console.warn(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                        await new Promise(res => setTimeout(res, delay));
                        retries++;
                        continue;
                    }

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    if (result.candidates && result.candidates.length > 0 &&
                        result.candidates[0].content && result.candidates[0].content.parts &&
                        result.candidates[0].content.parts.length > 0) {
                        const botResponseText = result.candidates[0].content.parts[0].text;
                        setMessages((prevMessages) => [...prevMessages, { text: botResponseText, sender: 'bot', timestamp: new Date() }]);
                    } else {
                        setMessages((prevMessages) => [...prevMessages, { text: "I couldn't generate a response. Please try again.", sender: 'bot', timestamp: new Date() }]);
                    }
                    break;
                } catch (error) {
                    console.error("Error sending message to Gemini:", error);
                    setMessages((prevMessages) => [...prevMessages, { text: `Error: ${error.message}. Please try again.`, sender: 'bot', timestamp: new Date() }]);
                    break;
                } finally {
                    setIsThinking(false);
                }
            }
            if (retries === maxRetries) {
                setMessage(`Failed to get a response from the chatbot after multiple retries due to rate limiting.`); // Fixed: Multi-line string
                setMessageType('error');
                setShowMessageBox(true);
                setIsThinking(false);
            }

        } catch (error) {
            console.error("Chatbot send message error:", error);
            setMessage(`Failed to send message: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
            setIsThinking(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-center p-6 bg-gray-900 shadow-lg">
                <h1 className="text-3xl font-extrabold text-blue-400">Maverick Chatbot</h1>
                <Button onClick={() => setCurrentPage('dashboard')} icon={Home} className="bg-gray-700 hover:bg-gray-600">
                    Back to Dashboard
                </Button>
            </header>

            {/* Main Content */}
            <main className="flex-grow p-6 flex justify-center items-center">
                <div className="bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700 w-full max-w-2xl flex flex-col h-[70vh]">
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center text-gray-400 mt-10">
                                <p>Start a conversation with Maverick!</p>
                                <p>Ask about career paths, skill development, or job search tips.</p>
                            </div>
                        )}
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`p-3 rounded-lg max-w-[80%] ${
                                        msg.sender === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-gray-700 text-gray-200 rounded-bl-none'
                                    }`}
                                >
                                    <p>{msg.text}</p>
                                    <span className="text-xs text-gray-300 block text-right mt-1">
                                        {msg.timestamp.toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="mt-4 flex gap-3">
                        <Input
                            id="chatInput"
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isThinking ? 'Maverick is thinking...' : 'Type your message...'}
                            className="flex-grow"
                            disabled={isThinking}
                        />
                        <Button type="submit" disabled={isThinking} icon={Send} className="bg-green-600 hover:bg-green-700">
                            Send
                        </Button>
                    </form>
                </div>
            </main>
            {showMessageBox && (
                <MessageBox message={message} type={messageType} onConfirm={() => setShowMessageBox(false)} />
            )}
        </div>
    );
};

// --- Dashboard Page (Modified for Chatbot and Radar Chart) ---
const Dashboard = ({ setCurrentPage }) => {
    const { userId, db, isAuthReady, userRole, auth, geminiConfig, appId } = useFirebase();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [showMessageBox, setShowMessageBox] = useState(false);
    const [jobDescription, setJobDescription] = useState('');
    const [jobAnalysisResult, setJobAnalysisResult] = useState(null);
    const [isAnalyzingJob, setIsAnalyzingJob] = useState(false);
    const [idealRoleSkills, setIdealRoleSkills] = useState([]);
    const [isFetchingIdealSkills, setIsFetchingIdealSkills] = useState(false);

    // NEW STATES FOR CACHING
    const [jobAnalysisCache, setJobAnalysisCache] = useState({});
    const [idealSkillsCache, setIdealSkillsCache] = useState({});

    // ⚠️ WARNING: Hardcoding API keys and model names directly into client-side code is a significant security risk.
    // This is done for testing purposes as per user request.
    // For production, use environment variables, a server-side proxy, or Firebase Cloud Functions.
    const TEST_GEMINI_API_KEY_FOR_DASHBOARD = "AIzaSyBc75KExuYBTeUU4554p7jANi-1Yptkc_Y"; // Replace with your actual test API key
    const TEST_GEMINI_MODEL_FOR_DASHBOARD = "gemini-2.5-flash"; // Explicitly set the model here

    // ALL HOOKS MUST BE DECLARED AT THE TOP LEVEL, UNCONDITIONALLY
    // Helper function to prepare data for the Radar Chart.
    const getRadarChartData = useCallback(() => {
        const data = [];
        const allSkills = new Set();

        // Collect all unique skill names from both user profile and ideal role.
        profile.skills.forEach(s => allSkills.add(s.name.toLowerCase()));
        idealRoleSkills.forEach(s => allSkills.add(s.skillName.toLowerCase()));

        // Populate the data array for the Radar Chart.
        allSkills.forEach(skillName => {
            const userSkill = profile.skills.find(s => s.name.toLowerCase() === skillName);
            const idealSkill = idealRoleSkills.find(s => s.skillName.toLowerCase() === skillName);

            data.push({
                subject: skillName.charAt(0).toUpperCase() + skillName.slice(1), // Capitalize first letter for display.
                'Your Proficiency': userSkill ? userSkill.level : 0, // User's skill level, default to 0.
                'Target Role Proficiency': idealSkill ? idealSkill.proficiency : 0, // Ideal skill level, default to 0.
                fullMark: 5, // Maximum proficiency level for the chart.
            });
        });
        return data;
    }, [profile?.skills, idealRoleSkills]); // Dependencies for memoization.


    useEffect(() => {
        // This effect handles user authentication and profile loading.
        // It redirects to 'auth' if not authenticated or to 'profileSetup' if no profile exists.
        if (isAuthReady && userId) {
            // Redirect non-employee users (e.g., admins) to their respective dashboards.
            if (userRole && userRole !== 'employee') {
                setCurrentPage(userRole === 'admin' ? 'adminDashboard' : 'auth');
                return;
            }
            // Set up a real-time listener for the user's profile data.
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setProfile(docSnap.data()); // Update profile state with fetched data.
                } else {
                    setCurrentPage('profileSetup'); // Redirect if profile doesn't exist.
                }
                setLoading(false); // Mark loading as complete.
            }, (error) => {
                console.error("Error fetching profile:", error);
                setMessage('Failed to load profile data.');
                setMessageType('error');
                setShowMessageBox(true);
                setLoading(false);
            });
            return () => unsubscribe(); // Clean up the listener on component unmount.
        } else if (isAuthReady && !userId) {
            setCurrentPage('auth'); // Redirect to auth if not logged in.
        }
    }, [isAuthReady, userId, db, setCurrentPage, userRole, appId]);

    useEffect(() => {
        // This effect fetches ideal skills for the target role using the Gemini API.
        const fetchIdealSkills = async () => {
            // Only proceed if a target role is set in the profile.
            if (!profile?.targetRole) {
                setIdealRoleSkills([]);
                return;
            }

            // --- CACHING LOGIC FOR IDEAL SKILLS ---
            // Check if the ideal skills for the current target role are already in the cache
            // and if they haven't expired (e.g., cached for 1 hour).
            if (idealSkillsCache[profile.targetRole]) {
                const now = new Date().getTime();
                if (idealSkillsCache[profile.targetRole].expiry > now) {
                    setIdealRoleSkills(idealSkillsCache[profile.targetRole].data);
                    setMessage('Using cached ideal role skills.');
                    setMessageType('info');
                    setShowMessageBox(true);
                    return; // Use cached data and exit.
                }
            }
            // --- END CACHING LOGIC ---

            setIsFetchingIdealSkills(true); // Set loading state.
            setIdealRoleSkills([]); // Clear previous suggestions.
            setMessage(`Fetching ideal skills for ${profile.targetRole}...`);
            setMessageType('info');
            setShowMessageBox(true);

            // Construct the prompt for the Gemini API.
            const prompt = `For the job role "${profile.targetRole}", identify the 5-7 most crucial skills and their typical proficiency levels. Assign a numerical proficiency score from 0 (Novice) to 5 (Expert) for each skill. Provide the response as a JSON array of objects, where each object has "skillName" (string) and "proficiency" (integer from 0-5).`;

            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = {
                contents: chatHistory,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: { "skillName": { "type": "STRING" }, "proficiency": { "type": "NUMBER" } },
                            "propertyOrdering": ["skillName", "proficiency"]
                        }
                    }
                }
            };
            // Using the hardcoded TEST_GEMINI_API_KEY_FOR_DASHBOARD and TEST_GEMINI_MODEL_FOR_DASHBOARD for this call.
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${TEST_GEMINI_MODEL_FOR_DASHBOARD}:generateContent?key=${TEST_GEMINI_API_KEY_FOR_DASHBOARD}`;

            let retries = 0;
            const maxRetries = 5;
            const baseDelay = 1000; // Initial delay for exponential backoff.

            // Implement retry logic with exponential backoff for API calls.
            while (retries < maxRetries) {
                try {
                    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

                    if (response.status === 429) { // Handle rate limiting.
                        const delay = baseDelay * Math.pow(2, retries);
                        await new Promise(res => setTimeout(res, delay));
                        retries++;
                        continue; // Retry the request.
                    }

                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                    const result = await response.json();
                    if (result.candidates?.length > 0 && result.candidates[0].content?.parts?.length > 0) {
                        const jsonString = result.candidates[0].content.parts[0].text;
                        const parsedJson = JSON.parse(jsonString);
                        setIdealRoleSkills(parsedJson);

                        // --- CACHE THE NEW RESULT ---
                        const now = new Date().getTime();
                        setIdealSkillsCache(prev => ({
                            ...prev,
                            [profile.targetRole]: { // Cache by target role.
                                data: parsedJson,
                                expiry: now + 3600000 // Cache for 1 hour (3600000 milliseconds).
                            }
                        }));
                        // --- END CACHING ---
                        setMessage('Ideal role skills fetched successfully!');
                        setMessageType('success');
                        setShowMessageBox(true);
                    } else {
                        setMessage('Failed to fetch ideal role skills: No valid response from API.');
                        setMessageType('error');
                        setShowMessageBox(true);
                    }
                    break; // Exit loop on success.
                } catch (error) {
                    console.error("Error fetching ideal role skills:", error);
                    setMessage(`Failed to fetch ideal role skills: ${error.message}`);
                    setMessageType('error');
                    setShowMessageBox(true);
                    break; // Exit loop on non-retryable error.
                } finally {
                    setIsFetchingIdealSkills(false); // End loading state.
                }
            }
            if (retries === maxRetries) {
                setMessage('Failed to fetch ideal role skills after multiple retries due to rate limiting.');
                setMessageType('error');
                setShowMessageBox(true);
                setIsFetchingIdealSkills(false);
            }
        };

        fetchIdealSkills();
    }, [profile, profile?.targetRole, idealSkillsCache, setShowMessageBox]); // Removed geminiConfig from dependencies as it's now hardcoded.

    // Handles user logout.
    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setCurrentPage('auth'); // Redirect to auth page after logout.
        } catch (error) {
            console.error("Error logging out:", error);
            setMessage(`Logout failed: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        }
    };

    // Analyzes a job description using the Gemini API.
    const analyzeJobDescription = async () => {
        if (!jobDescription.trim()) {
            setMessage('Please paste a job description to analyze.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }

        // --- CACHING LOGIC FOR JOB ANALYSIS ---
        // Check if the job description analysis is already in the cache.
        if (jobAnalysisCache.jobDescription === jobDescription) {
            setJobAnalysisResult(jobAnalysisCache.result);
            setMessage('Using cached analysis result.');
            setMessageType('info');
            setShowMessageBox(true);
            return; // Use cached data and exit.
        }
        // --- END CACHING LOGIC ---

        setIsAnalyzingJob(true); // Set loading state.
        setJobAnalysisResult(null); // Clear previous results.
        setMessage('Analyzing job description and identifying skill gaps, please wait...');
        setMessageType('info');
        setShowMessageBox(true);

        // Format user skills for the prompt.
        const userSkills = profile.skills.map(s => `${s.name} (Level: ${s.level})`).join(', ');

        // Construct the prompt for the Gemini API.
        const prompt = `Analyze the following job description and provide:
        1. A brief summary of the job.
        2. A list of key required skills for this job.
        3. Compare these required skills with the user's current skills: "${userSkills}".
        4. Identify any skill gaps and suggest specific areas for improvement or learning modules.

        Format the response as a JSON object with the following structure:
        {
          "jobSummary": "string",
          "requiredSkills": ["skill1", "skill2"],
          "skillGaps": ["skill_gap1", "skill_gap2"],
          "improvementSuggestions": "string"
        }

        Job Description:
        ${jobDescription}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "jobSummary": { "type": "STRING" },
                        "requiredSkills": { "type": "ARRAY", "items": { "type": "STRING" } },
                        "skillGaps": { "type": "ARRAY", "items": { "type": "STRING" } },
                        "improvementSuggestions": { "type": "STRING" }
                    },
                    "propertyOrdering": ["jobSummary", "requiredSkills", "skillGaps", "improvementSuggestions"]
                }
            }
        };
        // Using the hardcoded TEST_GEMINI_API_KEY_FOR_DASHBOARD and TEST_GEMINI_MODEL_FOR_DASHBOARD for this call.
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${TEST_GEMINI_MODEL_FOR_DASHBOARD}:generateContent?key=${TEST_GEMINI_API_KEY_FOR_DASHBOARD}`;

        let retries = 0;
        const maxRetries = 5;
        const baseDelay = 1000; // Initial delay for exponential backoff.

        // Implement retry logic with exponential backoff for API calls.
        while (retries < maxRetries) {
            try {
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (response.status === 429) { // Handle rate limiting.
                    const delay = baseDelay * Math.pow(2, retries);
                    await new Promise(res => setTimeout(res, delay));
                    retries++;
                    continue; // Retry the request.
                }
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                if (result.candidates?.length > 0 && result.candidates[0].content?.parts?.length > 0) {
                    const jsonString = result.candidates[0].content.parts[0].text;
                    const parsedJson = JSON.parse(jsonString);
                    setJobAnalysisResult(parsedJson);

                    // --- CACHE THE NEW RESULT ---
                    setJobAnalysisCache({
                        jobDescription: jobDescription, // Cache by the job description text.
                        result: parsedJson
                    });
                    // --- END CACHING ---
                    setMessage('Job description analyzed successfully!');
                    setMessageType('success');
                    setShowMessageBox(true);
                } else {
                    setMessage('Failed to analyze job description: No valid response from API.');
                    setMessageType('error');
                    setShowMessageBox(true);
                }
                break; // Exit loop on success.
            } catch (error) {
                console.error("Error analyzing job description:", error);
                setMessage(`Failed to analyze job description: ${error.message}`);
                setMessageType('error');
                setShowMessageBox(true);
                break; // Exit loop on non-retryable error.
            } finally {
                setIsAnalyzingJob(false); // End loading state.
            }
        }
    };

    // Display loading page while profile data is being fetched.
    if (loading) {
        return <LoadingPage message="Loading dashboard..." />;
    }
    // Display loading page if profile data is not found (and redirection is pending).
    if (!profile) {
        return <LoadingPage message="Profile not found, redirecting..." />;
    }

    // Navigation items for the sidebar.
    const navItems = [
        { name: 'Home', icon: Home, page: 'dashboard' },
        { name: 'Profile', icon: User, page: 'profileSetup' },
        { name: 'Assessment', icon: Target, page: 'assessment' },
        { name: 'Learning Platform', icon: Brain, page: 'learningPlatform' },
        { name: 'Leaderboard', icon: Award, page: 'leaderboard' },
        { name: 'Maverick Assistant', icon: MessageSquare, page: 'maverickChatbot' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-center p-6 bg-gray-900 shadow-lg">
                <h1 className="text-3xl font-extrabold text-blue-400">Maverick</h1>
                <div className="flex items-center gap-4">
                    <span className="text-lg font-medium">Welcome, {profile?.fullName || profile?.email || 'User'}!</span>
                    <Button onClick={handleLogout} icon={LogOut} className="bg-red-600 hover:bg-red-700">
                        Logout
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-grow p-6 gap-6">
                {/* Sidebar Navigation */}
                <nav className="w-64 bg-gray-800 rounded-xl shadow-xl p-6 flex flex-col gap-4">
                    {navItems.map((item) => (
                        <Button
                            key={item.name}
                            onClick={() => setCurrentPage(item.page)}
                            icon={item.icon}
                            className="justify-start w-full bg-gray-700 hover:bg-gray-600 text-left"
                        >
                            {item.name}
                        </Button>
                    ))}
                </nav>

                {/* Dashboard Content Area */}
                <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Profile Summary Card */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700 col-span-1 md:col-span-2 lg:col-span-3">
                        <h3 className="text-2xl font-bold mb-4 text-blue-300 flex items-center gap-2"><User size={24} /> Your Profile Summary</h3>
                        <p className="text-lg mb-2">
                            <span className="font-semibold">Email:</span> {profile?.email}
                        </p>
                        <p className="text-lg mb-2">
                            <span className="font-semibold">Target Role:</span> {profile?.targetRole || 'Not set'}
                        </p>
                        <p className="text-lg mb-2">
                            <span className="font-semibold">Points:</span> {profile?.points || 0}
                        </p>
                        <div className="mt-4">
                            <h4 className="text-xl font-semibold mb-2 text-gray-300">Skillsets:</h4>
                            {profile?.skills && profile.skills.length > 0 ? (
                                <ul className="list-disc list-inside ml-4">
                                    {profile.skills.map((skill, index) => (
                                        <li key={index} className="text-gray-300">
                                            {skill.name} (<span className="font-medium text-blue-400">Level: {skill.level}</span>)
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-400">No skills added yet. Go to Profile to add some!</p>
                            )}
                        </div>
                        <Button onClick={() => setCurrentPage('profileSetup')} icon={Edit} className="mt-6 bg-purple-600 hover:bg-purple-700">
                            Edit Profile
                        </Button>
                    </div>

                    {/* Skill Proficiency Radar Chart Card */}
                    {/* Only render if target role is set, user has skills, and ideal skills are fetched. */}
                    {profile?.targetRole && profile?.skills && profile.skills.length > 0 && idealRoleSkills.length > 0 && (
                        <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700 col-span-1 md:col-span-2">
                            <h3 className="text-2xl font-bold mb-4 text-orange-300 flex items-center gap-2"><BarChart size={24} /> Skill Proficiency Comparison</h3>
                            {isFetchingIdealSkills ? (
                                <p className="text-gray-400 text-center">Loading skill comparison data...</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart outerRadius={90} width={730} height={250} data={getRadarChartData()}>
                                        <PolarGrid stroke="#4a5568" />
                                        <PolarAngleAxis dataKey="subject" stroke="#cbd5e0" />
                                        <PolarRadiusAxis angle={90} domain={[0, 5]} stroke="#cbd5e0" />
                                        <Radar name="Your Proficiency" dataKey="Your Proficiency" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                                        <Radar name="Target Role Proficiency" dataKey="Target Role Proficiency" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                                        <Legend wrapperStyle={{ color: '#ffffff' }} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            )}
                            <p className="text-gray-400 text-sm mt-4 text-center">
                                Compares your self-assessed skill levels with the ideal proficiency for your target role: <span className="font-semibold text-blue-300">{profile.targetRole}</span>.
                            </p>
                        </div>
                    )}


                    {/* Workflow Progress Card */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
                        <h3 className="text-2xl font-bold mb-4 text-green-300 flex items-center gap-2"><BarChart size={24} /> Workflow Progress</h3>
                        <ProgressBar progress={profile?.workflowProgress || 0} />
                        <p className="text-center text-gray-300 mt-2">{profile?.workflowProgress || 0}% Complete</p>
                        <Button onClick={() => setCurrentPage('learningPlatform')} className="mt-4 w-full bg-green-600 hover:bg-green-700">
                            Continue Learning
                        </Button>
                    </div>

                    {/* Completed Modules Card */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
                        <h3 className="text-2xl font-bold mb-4 text-yellow-300 flex items-center gap-2"><BookOpen size={24} /> Completed Modules</h3>
                        {profile?.completedModules && profile.completedModules.length > 0 ? (
                            <ul className="list-disc list-inside ml-4">
                                {profile.completedModules.map((module, index) => (
                                    <li key={index} className="text-gray-300">{module}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-400">No modules completed yet.</p>
                        )}
                        <Button onClick={() => setCurrentPage('learningPlatform')} className="mt-4 w-full bg-yellow-600 hover:bg-yellow-700">
                            Explore Modules
                        </Button>
                    </div>

                    {/* Quick Access Card */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
                        <h3 className="text-2xl font-bold mb-4 text-red-300 flex items-center gap-2"><MessageSquare size={24} /> Quick Access</h3>
                        <div className="flex flex-col gap-3">
                            <Button onClick={() => setCurrentPage('assessment')} icon={Target} className="bg-indigo-600 hover:bg-indigo-700">
                                Take Assessment
                            </Button>
                            <Button onClick={() => setCurrentPage('leaderboard')} icon={Award} className="bg-teal-600 hover:bg-teal-700">
                                View Leaderboard
                            </Button>
                            <Button onClick={() => setCurrentPage('maverickChatbot')} icon={MessageSquare} className="bg-blue-600 hover:bg-blue-700">
                                Chat with Maverick
                            </Button>
                        </div>
                    </div>

                    {/* Job Matching & Skill Analysis Card */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700 col-span-1 md:col-span-2 lg:col-span-3">
                        <h3 className="text-2xl font-bold mb-4 text-orange-300 flex items-center gap-2"><ClipboardList size={24} /> Job Matching & Skill Analysis</h3>
                        <Textarea
                            id="jobDescription"
                            label="Paste Job Description Here:"
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder="e.g., Senior Software Engineer, Data Scientist, Marketing Manager..."
                            rows="6"
                            className="mb-4"
                        />
                        <Button
                            onClick={analyzeJobDescription}
                            disabled={isAnalyzingJob}
                            icon={TrendingUp}
                            className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                            {isAnalyzingJob ? 'Analyzing...' : 'Analyze Job Description'}
                        </Button>

                        {jobAnalysisResult && (
                            <div className="mt-6 bg-gray-700 p-6 rounded-lg shadow-inner">
                                <h4 className="text-xl font-semibold text-white mb-3">Analysis Results:</h4>
                                <div className="space-y-4 text-gray-300">
                                    <div>
                                        <p className="font-semibold">Job Summary:</p>
                                        <p>{jobAnalysisResult.jobSummary}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold">Required Skills:</p>
                                        <ul className="list-disc list-inside ml-4">
                                            {jobAnalysisResult.requiredSkills.map((skill, idx) => (
                                                <li key={idx}>{skill}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-semibold">Skill Gaps:</p>
                                        {jobAnalysisResult.skillGaps && jobAnalysisResult.skillGaps.length > 0 ? (
                                            <ul className="list-disc list-inside ml-4 text-red-300">
                                                {jobAnalysisResult.skillGaps.map((gap, idx) => (
                                                    <li key={idx}>{gap}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-green-300">No significant skill gaps identified! Great match!</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold">Improvement Suggestions:</p>
                                        <div className="prose prose-invert max-w-none text-gray-300">
                                            <div dangerouslySetInnerHTML={{ __html: jobAnalysisResult.improvementSuggestions.replace(/\n/g, '<br />') }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            {showMessageBox && (
                <MessageBox message={message} type={messageType} onConfirm={() => setShowMessageBox(false)} />
            )}
        </div>
    );
};

// --- Admin Dashboard Page ---
const AdminDashboard = ({ setCurrentPage }) => {
    const { db, isAuthReady, userRole, auth, appId } = useFirebase();
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [showMessageBox, setShowMessageBox] = useState(false);

    // User Management States
    const [allUsers, setAllUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);

    // Content Management States
    const [content, setContent] = useState([]);
    const [isLoadingContent, setIsLoadingContent] = useState(true);
    const [contentTitle, setContentTitle] = useState('');
    const [contentType, setContentType] = useState('module');
    const [contentCategory, setContentCategory] = useState('');
    const [contentUrl, setContentUrl] = useState('');
    const [contentDescription, setContentDescription] = useState('');
    const [moduleContent, setModuleContent] = useState(''); // NEW: State for detailed module content
    const [isAddingContent, setIsAddingContent] = useState(false);

    // NEW Assessment Form States
    const [assessmentTitle, setAssessmentTitle] = useState('');
    const [assessmentTopic, setAssessmentTopic] = useState('');
    const [assessmentQuestions, setAssessmentQuestions] = useState([
        { questionText: '', options: [{ text: '', isCorrect: false }], explanation: '' }
    ]);
    const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);

    // Employee Recommendation States
    const [roleSearchQuery, setRoleSearchQuery] = useState('');
    const [recommendedEmployees, setRecommendedEmployees] = useState([]);
    const [isRecommending, setIsRecommending] = useState(false);
    const [recommendationMessage, setRecommendationMessage] = useState('');
    const [selectedRecommendedEmployee, setSelectedRecommendedEmployee] = useState(null);
    const [showRecommendedEmployeeDetailsModal, setShowRecommendedEmployeeDetailsModal] = useState(false);

    // Gemini API setup
    const GEMINI_API_KEY = "AIzaSyB6wk7U8bANHoN6e8T3wnWYC5TsInOWusQ"; // Use your actual API key(1)
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    useEffect(() => {
        if (isAuthReady && userRole !== 'admin') {
            setCurrentPage(userRole === 'employee' ? 'dashboard' : 'auth');
            return;
        }

        if (isAuthReady && db) {
            const usersColRef = collection(db, `artifacts/${appId}/users`);
            const unsubscribeUsers = onSnapshot(usersColRef, async (snapshot) => {
                setIsLoadingUsers(true);
                const userPromises = snapshot.docs.map(async (docSnap) => {
                    const profileDocRef = doc(db, `artifacts/${appId}/users/${docSnap.id}/profile/data`);
                    try {
                        const profileSnap = await getDoc(profileDocRef);
                        if (profileSnap.exists()) {
                            const profileData = profileSnap.data();
                            return {
                                id: docSnap.id,
                                email: profileData.email || 'N/A',
                                fullName: profileData.fullName || 'N/A',
                                userType: profileData.userType || 'N/A',
                                profile: profileData
                            };
                        } else {
                            return {
                                id: docSnap.id,
                                email: 'Profile Pending/Missing',
                                fullName: 'Profile Pending/Missing',
                                userType: 'Unknown',
                                profile: {}
                            };
                        }
                    } catch (error) {
                        console.error(`Error fetching profile for user ID ${docSnap.id}:`, error);
                        return {
                            id: docSnap.id,
                            email: `Error: ${error.message}`,
                            fullName: `Error: ${error.message}`,
                            userType: 'Error',
                            profile: {}
                        };
                    }
                });

                const usersList = await Promise.all(userPromises);
                setAllUsers(usersList);
                setFilteredUsers(usersList);
                setIsLoadingUsers(false);
            }, (error) => {
                console.error("Error fetching users collection:", error);
                setMessage('Failed to load user data. Please check your Firebase security rules and ensure users exist.');
                setMessageType('error');
                setShowMessageBox(true);
                setIsLoadingUsers(false);
            });

            const contentColRef = collection(db, `artifacts/${appId}/content`);
            const unsubscribeContent = onSnapshot(contentColRef, (snapshot) => {
                const contentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setContent(contentList);
                setIsLoadingContent(false);
            }, (error) => {
                console.error("Error fetching content:", error);
                setMessage('Failed to load content data.');
                setMessageType('error');
                setShowMessageBox(true);
                setIsLoadingContent(false);
            });

            return () => {
                unsubscribeUsers();
                unsubscribeContent();
            };
        }
    }, [isAuthReady, userRole, db, setCurrentPage, appId]);

    useEffect(() => {
        const lowerCaseQuery = userSearchQuery.toLowerCase();
        const filtered = allUsers.filter(user =>
            user.email?.toLowerCase().includes(lowerCaseQuery) ||
            user.fullName?.toLowerCase().includes(lowerCaseQuery) ||
            user.userType?.toLowerCase().includes(lowerCaseQuery) ||
            user.profile?.skills?.some(s => s.name.toLowerCase().includes(lowerCaseQuery))
        );
        setFilteredUsers(filtered);
    }, [userSearchQuery, allUsers]);

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setCurrentPage('auth');
        } catch (error) {
            console.error("Error logging out:", error);
            setMessage(`Logout failed: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        }
    };

    const deleteUser = async (userIdToDelete) => {
        if (!db) return;
        const confirmed = window.confirm(`Are you sure you want to delete user ${userIdToDelete}? This action cannot be undone.`);
        if (!confirmed) {
            return;
        }

        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${userIdToDelete}`);
            await deleteDoc(userDocRef);
            setMessage('User deleted successfully!');
            setMessageType('success');
            setShowMessageBox(true);
        } catch (error) {
            console.error("Error deleting user:", error);
            setMessage(`Failed to delete user: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        }
    };

    const handleAddContent = async (e) => {
        e.preventDefault();
        setIsAddingContent(true);
        setShowMessageBox(false);

        try {
            if (!contentTitle || !contentType || !contentCategory) {
                setMessage('Please fill in all required fields (Title, Type, Category).');
                setMessageType('error');
                setShowMessageBox(true);
                setIsAddingContent(false);
                return;
            }

            const contentData = {
                title: contentTitle,
                type: contentType,
                category: contentCategory,
                description: contentDescription,
                createdAt: new Date(),
            };

            // Conditionally add contentUrl or moduleContent based on contentType
            if (contentType === 'module') {
                contentData.contentUrl = contentUrl || null;
                contentData.moduleContent = moduleContent || null; // Save new module content
            } else { // For assessment or resource, contentUrl is still optional
                contentData.contentUrl = contentUrl || null;
            }


            await setDoc(doc(collection(db, `artifacts/${appId}/content`)), contentData);

            setMessage('Content added successfully!');
            setMessageType('success');
            setShowMessageBox(true);
            // Clear form
            setContentTitle('');
            setContentType('module');
            setContentCategory('');
            setContentUrl('');
            setContentDescription('');
            setModuleContent(''); // Clear new module content state
        } catch (error) {
            console.error("Error adding content:", error);
            setMessage(`Failed to add content: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        } finally {
            setIsAddingContent(false);
        }
    };

    const handleCreateAssessment = async (e) => {
        e.preventDefault();
        setIsCreatingAssessment(true);
        setShowMessageBox(false);

        try {
            if (!assessmentTitle || !assessmentTopic || assessmentQuestions.length === 0 || assessmentQuestions.some(q => !q.questionText || q.options.some(o => !o.text) || !q.options.find(o => o.isCorrect))) {
                setMessage('Please fill in all assessment fields and ensure at least one correct option is selected for each question.');
                setMessageType('error');
                setShowMessageBox(true);
                setIsCreatingAssessment(false);
                return;
            }

            const formattedQuestions = assessmentQuestions.map(q => {
                const options = q.options.map(o => o.text);
                const correctOptionIndex = q.options.findIndex(o => o.isCorrect);
                const correctAnswer = String.fromCharCode(65 + correctOptionIndex);

                return {
                    questionText: q.questionText,
                    options: options,
                    correctAnswer: correctAnswer,
                    explanation: q.explanation,
                };
            });

            await setDoc(doc(collection(db, `artifacts/${appId}/content`)), {
                title: assessmentTitle,
                type: 'assessment',
                category: assessmentTopic,
                questions: formattedQuestions,
                createdAt: new Date(),
            });

            setMessage('Assessment created and added successfully!');
            setMessageType('success');
            setShowMessageBox(true);

            setAssessmentTitle('');
            setAssessmentTopic('');
            setAssessmentQuestions([{ questionText: '', options: [{ text: '', isCorrect: false }], explanation: '' }]);

        } catch (error) {
            console.error("Error creating assessment:", error);
            setMessage(`Failed to create assessment: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        } finally {
            setIsCreatingAssessment(false);
        }
    };

    const handleAddQuestion = () => {
        setAssessmentQuestions([...assessmentQuestions, { questionText: '', options: [{ text: '', isCorrect: false }], explanation: '' }]);
    };

    const handleRemoveQuestion = (index) => {
        const newQuestions = [...assessmentQuestions];
        newQuestions.splice(index, 1);
        setAssessmentQuestions(newQuestions);
    };

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...assessmentQuestions];
        newQuestions[index][field] = value;
        setAssessmentQuestions(newQuestions);
    };

    const handleOptionChange = (questionIndex, optionIndex, value) => {
        const newQuestions = [...assessmentQuestions];
        // Ensure the options array exists and has enough elements
        if (!newQuestions[questionIndex].options[optionIndex]) {
            newQuestions[questionIndex].options[optionIndex] = { text: '', isCorrect: false };
        }
        newQuestions[questionIndex].options[optionIndex].text = value;
        setAssessmentQuestions(newQuestions);
    };

    const handleCorrectOptionChange = (questionIndex, optionIndex) => {
        const newQuestions = [...assessmentQuestions];
        newQuestions[questionIndex].options.forEach((option, idx) => {
            option.isCorrect = (idx === optionIndex);
        });
        setAssessmentQuestions(newQuestions);
    };

    const deleteContent = async (contentIdToDelete) => {
        if (!db) return;
        const confirmed = window.confirm(`Are you sure you want to delete content ${contentIdToDelete}?`);
        if (!confirmed) {
            return;
        }

        try {
            const contentDocRef = doc(db, `artifacts/${appId}/content/${contentIdToDelete}`);
            await deleteDoc(contentDocRef);
            setMessage('Content deleted successfully!');
            setMessageType('success');
            setShowMessageBox(true);
        } catch (error) {
            console.error("Error deleting content:", error);
            setMessage(`Failed to delete content: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        }
    };

    const handleRoleRecommendationSearch = async () => {
        if (!roleSearchQuery.trim()) {
            setRecommendationMessage('Please enter a role to get recommendations.');
            return;
        }

        setIsRecommending(true);
        setRecommendationMessage('');
        setRecommendedEmployees([]);

        try {
            const employeesForGemini = allUsers.map(user => ({
                id: user.id,
                email: user.email,
                fullName: user.profile?.fullName || 'N/A',
                skills: user.profile?.skills || [],
            }));

            const prompt = `Task: Act as a talent scout. Given a target role description, identify the best-fitting employees from a provided list. Employee Data (JSON array): ${JSON.stringify(employeesForGemini)} Instructions: 1. Analyze the "Target Role Description" to infer the required skills. 2. Match these skills against the "skills" array of each employee. 3. Recommend the top 3 to 5 employees who are the best fit. 4. For each recommended employee, provide their 'id', 'email', 'fullName', a list of their 'matchingSkills' (skills that match the inferred role requirements), and a 'score' (a number from 0-100 indicating how well they fit the role). 5. The score should be based on the number of matching skills and their proficiency levels. 6. Output the result as a raw JSON array of objects. Do not include any additional text, markdown, or explanations before or after the JSON.`;

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            let parsedRecommendations;
            try {
                const cleanedText = text.replace(/```json\n|\n```/g, '').trim();
                parsedRecommendations = JSON.parse(cleanedText);
            } catch (jsonError) {
                console.error("Failed to parse Gemini response as JSON:", jsonError, "Raw text:", text);
                setRecommendationMessage('Failed to parse recommendations. Gemini returned invalid JSON. Please try refining the prompt or checking Gemini\'s output format.');
                setIsRecommending(false);
                return;
            }

            if (Array.isArray(parsedRecommendations) && parsedRecommendations.length > 0) {
                const enrichedRecommendations = parsedRecommendations.map(rec => {
                    const userDetail = allUsers.find(u => u.id === rec.id);
                    return userDetail ? {
                        ...rec,
                        fullProfile: userDetail.profile,
                        recommendedRoleName: roleSearchQuery
                    } : rec;
                }).filter(rec => rec.fullProfile);

                setRecommendedEmployees(enrichedRecommendations);
                setRecommendationMessage(`Recommendations found for "${roleSearchQuery}".`);
            } else {
                setRecommendationMessage(`No employees recommended for "${roleSearchQuery}".`);
            }
        } catch (error) {
            console.error("Gemini API error for employee recommendations:", error);
            setRecommendationMessage(`Failed to get recommendations: ${error.message}.`);
        } finally {
            setIsRecommending(false);
        }
    };

    const navItems = [
        { name: 'Dashboard', icon: Home, sectionId: 'dashboard-overview' },
        { name: 'Manage Users', icon: Users, sectionId: 'users' },
        { name: 'Manage Content', icon: UploadCloud, sectionId: 'content' },
        { name: 'Employee Recommendations', icon: UserCheck, sectionId: 'recommendations' },
        { name: 'Settings', icon: Settings, sectionId: 'settings' },
    ];

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    if (!isAuthReady || isLoadingUsers || isLoadingContent) {
        return <LoadingPage message="Loading admin dashboard..." />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
            <header className="flex justify-between items-center p-6 bg-gray-900 shadow-lg">
                <h1 className="text-3xl font-extrabold text-blue-400">Admin Dashboard</h1>
                <Button onClick={handleLogout} icon={LogOut} className="bg-red-600 hover:bg-red-700">
                    Logout
                </Button>
            </header>

            <main className="flex flex-grow p-6 gap-6">
                <nav className="w-64 bg-gray-800 rounded-xl shadow-xl p-6 flex flex-col gap-4">
                    {navItems.map((item) => (
                        <Button
                            key={item.name}
                            onClick={() => scrollToSection(item.sectionId)}
                            icon={item.icon}
                            className="justify-start w-full bg-gray-700 hover:bg-gray-600 text-left"
                        >
                            {item.name}
                        </Button>
                    ))}
                </nav>

                <div className="flex-grow flex flex-col gap-6 overflow-y-auto">
                    {/* Dashboard Overview */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700" id="dashboard-overview">
                        <h3 className="text-2xl font-bold mb-4 text-green-300 flex items-center gap-2">
                            <Home size={24} /> Dashboard Overview
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-gray-700 p-4 rounded-lg shadow-inner flex items-center gap-3">
                                <Users size={32} className="text-blue-400" />
                                <div>
                                    <p className="text-gray-300 text-sm">Total Users</p>
                                    <p className="text-2xl font-bold text-white">{allUsers.length}</p>
                                </div>
                            </div>
                            <div className="bg-gray-700 p-4 rounded-lg shadow-inner flex items-center gap-3">
                                <UploadCloud size={32} className="text-teal-400" />
                                <div>
                                    <p className="text-gray-300 text-sm">Total Content Items</p>
                                    <p className="text-2xl font-bold text-white">{content.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <hr className="my-6 border-gray-700" />

                    {/* User Management Section */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700" id="users">
                        <h3 className="text-2xl font-bold mb-4 text-purple-300 flex items-center gap-2">
                            <Users size={24} /> User Management
                        </h3>
                        <div className="mb-4">
                            <Input
                                id="userSearch"
                                label="Search Users"
                                type="text"
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                placeholder="Search by email, name, role, or skill..."
                            />
                        </div>
                        <div className="mt-4">
                            {isLoadingUsers ? (
                                <p className="text-gray-400">Loading users...</p>
                            ) : filteredUsers.length === 0 && userSearchQuery ? (
                                <p className="text-gray-400">No users found matching "{userSearchQuery}".</p>
                            ) : filteredUsers.length === 0 ? (
                                <p className="text-gray-400">No users available.</p>
                            ) : (
                                <>
                                    <div className="hidden md:block overflow-x-auto rounded-lg">
                                        <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                                            <thead className="bg-gray-600">
                                                <tr>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Email</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Name</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Role</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Skills</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredUsers.map((user) => (
                                                    <tr key={user.id} className="border-t border-gray-600 hover:bg-gray-600">
                                                        <td className="py-3 px-4 text-gray-300">{user.email || 'N/A'}</td>
                                                        <td className="py-3 px-4 text-gray-300">{user.fullName || 'N/A'}</td>
                                                        <td className="py-3 px-4 text-gray-300">{user.userType || 'N/A'}</td>
                                                        <td className="py-3 px-4 text-gray-300 max-w-sm truncate">
                                                            {user.profile?.skills && user.profile.skills.length > 0
                                                                ? user.profile.skills.map(s => `${s.name} (Lvl ${s.level})`).join(', ')
                                                                : 'No skills'}
                                                        </td>
                                                        <td className="py-3 px-4 flex gap-2">
                                                            <Button onClick={() => { setSelectedUser(user.profile); setShowUserDetailsModal(true); }} icon={Eye} className="bg-blue-600 hover:bg-blue-700 text-xs">
                                                                View
                                                            </Button>
                                                            <Button onClick={() => deleteUser(user.id)} icon={XCircle} className="bg-red-600 hover:bg-red-700 text-xs">
                                                                Delete
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="grid md:hidden grid-cols-1 gap-4">
                                        {filteredUsers.map((user) => (
                                            <div key={user.id} className="bg-gray-700 p-4 rounded-lg shadow-md flex flex-col gap-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-lg font-semibold text-blue-300">{user.fullName || 'N/A'}</h4>
                                                    <span className="text-xs font-medium bg-gray-600 text-gray-200 rounded-full px-2 py-1">{user.userType || 'N/A'}</span>
                                                </div>
                                                <p className="text-gray-400 text-sm">{user.email || 'N/A'}</p>
                                                <p className="text-gray-400 text-sm mt-1">
                                                    <span className="font-semibold text-gray-300">Skills:</span> {user.profile?.skills && user.profile.skills.length > 0
                                                        ? user.profile.skills.map(s => `${s.name}`).join(', ')
                                                        : 'No skills'}
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    <Button onClick={() => { setSelectedUser(user.profile); setShowUserDetailsModal(true); }} icon={Eye} className="bg-blue-600 hover:bg-blue-700 text-xs flex-grow">
                                                        View
                                                    </Button>
                                                    <Button onClick={() => deleteUser(user.id)} icon={XCircle} className="bg-red-600 hover:bg-red-700 text-xs flex-grow">
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <hr className="my-6 border-gray-700" />

                    {/* Employee Recommendation Section */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700" id="recommendations">
                        <h3 className="text-2xl font-bold mb-4 text-pink-300 flex items-center gap-2">
                            <UserCheck size={24} /> Employee Recommendations
                        </h3>
                        <div className="flex gap-4 mb-4">
                            <Input
                                id="roleSearch"
                                label="Target Role for Recommendation"
                                type="text"
                                value={roleSearchQuery}
                                onChange={(e) => setRoleSearchQuery(e.target.value)}
                                placeholder="e.g., Python Developer, HR Specialist"
                                className="flex-grow"
                            />
                            <Button
                                onClick={handleRoleRecommendationSearch}
                                disabled={isRecommending || !roleSearchQuery.trim()}
                                className="bg-green-600 hover:bg-green-700 self-end"
                            >
                                {isRecommending ? 'Searching...' : 'Search Recommendations'}
                            </Button>
                        </div>

                        {recommendationMessage && (
                            <MessageBox
                                message={recommendationMessage}
                                type={recommendationMessage.includes('Failed') || recommendationMessage.includes('not found') ? 'error' : 'info'}
                                onConfirm={() => setRecommendationMessage('')}
                            />
                        )}

                        {isRecommending && <p className="text-blue-300">Generating recommendations...</p>}

                        {recommendedEmployees.length > 0 && !isRecommending && (
                            <div className="mt-4">
                                <h4 className="text-xl font-semibold text-white mb-3">Recommended Employees:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {recommendedEmployees.map((employee) => (
                                        <div key={employee.id} className="bg-gray-700 p-4 rounded-lg shadow-md">
                                            <h5 className="text-lg font-bold text-blue-300">{employee.fullName || employee.email}</h5>
                                            <p className="text-gray-400 text-sm">Email: {employee.email}</p>
                                            <p className="text-gray-400 text-sm">Score: {employee.score ? `${employee.score}%` : 'N/A'}</p>

                                            <h6 className="text-md font-semibold text-purple-200 mt-2">AI-Identified Matching Skills:</h6>
                                            <ul className="list-disc list-inside text-gray-300 text-sm mb-2">
                                                {employee.matchingSkills && employee.matchingSkills.length > 0 ? (
                                                    employee.matchingSkills.map((skill, idx) => (
                                                        <li key={idx}>{skill.name} (Level {skill.level})</li>
                                                    ))
                                                ) : (
                                                    <li>No specific matching skills identified by AI.</li>
                                                )}
                                            </ul>
                                            <Button
                                                onClick={() => { setSelectedUser({ ...employee.fullProfile, userId: employee.id }); setShowUserDetailsModal(true); }} icon={Eye} className="bg-blue-600 hover:bg-blue-700 text-xs w-full">
                                                View Full Profile & Skill Comparison
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <hr className="my-6 border-gray-700" />

                    {/* Content Management Section */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700" id="content">
                        <h3 className="text-2xl font-bold mb-4 text-teal-300 flex items-center gap-2">
                            <UploadCloud size={24} /> Content Management
                        </h3>

                        {/* Add New Learning Content Form */}
                        <div className="bg-gray-700 p-6 rounded-lg shadow-inner mb-6">
                            <h4 className="text-xl font-semibold text-white mb-4">Add New Learning Content</h4>
                            <form onSubmit={handleAddContent} className="space-y-4">
                                <Input
                                    id="contentTitle"
                                    label="Title"
                                    type="text"
                                    value={contentTitle}
                                    onChange={(e) => setContentTitle(e.target.value)}
                                    placeholder="e.g., Introduction to React, Advanced Python"
                                    required
                                />
                                <Select
                                    id="contentType"
                                    label="Content Type"
                                    value={contentType}
                                    onChange={(e) => {
                                        setContentType(e.target.value);
                                        // Clear content-specific fields when type changes
                                        setContentUrl('');
                                        setContentDescription('');
                                        setModuleContent('');
                                    }}
                                    options={[
                                        { value: 'module', label: 'Module' },
                                        { value: 'assessment', label: 'Assessment' },
                                        { value: 'resource', label: 'Resource' },
                                    ]}
                                    required
                                />
                                <Input
                                    id="contentCategory"
                                    label="Category"
                                    type="text"
                                    value={contentCategory}
                                    onChange={(e) => setContentCategory(e.target.value)}
                                    placeholder="e.g., Programming, Soft Skills, Data Science"
                                    required
                                />

                                {/* Conditional fields for Module content type */}
                                {contentType === 'module' && (
                                    <>
                                        <Input
                                            id="contentUrl"
                                            label="External Content URL (Optional)"
                                            type="url"
                                            value={contentUrl}
                                            onChange={(e) => setContentUrl(e.target.value)}
                                            placeholder="https://example.com/external-course"
                                        />
                                        <Textarea
                                            id="moduleContent"
                                            label="Module Content (Manual, if no URL)"
                                            value={moduleContent}
                                            onChange={(e) => setModuleContent(e.target.value)}
                                            placeholder="Enter the detailed learning content here. This will be displayed if no external URL is provided."
                                            rows="8"
                                        />
                                    </>
                                )}

                                {/* Description is always present but might be used differently per type */}
                                <Textarea
                                    id="contentDescription"
                                    label="Short Description"
                                    value={contentDescription}
                                    onChange={(e) => setContentDescription(e.target.value)}
                                    placeholder="A brief summary or overview of the content"
                                    rows="3"
                                />

                                <Button type="submit" disabled={isAddingContent} className="w-full bg-blue-600 hover:bg-blue-700">
                                    {isAddingContent ? 'Adding Content...' : 'Add Content'}
                                </Button>
                            </form>
                        </div>

                        {/* Manually Create Assessment Form */}
                        <div className="bg-gray-700 p-6 rounded-lg shadow-inner mb-6">
                            <h4 className="text-xl font-semibold text-white mb-4">Manually Create New Assessment</h4>
                            <form onSubmit={handleCreateAssessment} className="space-y-4">
                                <Input
                                    id="assessmentTitle"
                                    label="Assessment Title"
                                    type="text"
                                    value={assessmentTitle}
                                    onChange={(e) => setAssessmentTitle(e.target.value)}
                                    placeholder="e.g., Python Fundamentals Quiz"
                                    required
                                />
                                <Input
                                    id="assessmentTopic"
                                    label="Assessment Topic/Category"
                                    type="text"
                                    value={assessmentTopic}
                                    onChange={(e) => setAssessmentTopic(e.target.value)}
                                    placeholder="e.g., Python, Data Science"
                                    required
                                />
                                <hr className="my-4 border-gray-600" />

                                {assessmentQuestions.map((q, qIndex) => (
                                    <div key={qIndex} className="bg-gray-600 p-4 rounded-lg space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h5 className="text-lg font-semibold text-white">Question {qIndex + 1}</h5>
                                            <Button type="button" onClick={() => handleRemoveQuestion(qIndex)} icon={XCircle} className="bg-red-600 hover:bg-red-700 text-xs">Remove</Button>
                                        </div>
                                        <Textarea
                                            id={`question-${qIndex}-text`}
                                            label="Question Text"
                                            value={q.questionText}
                                            onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                                            rows="2"
                                            required
                                        />
                                        <div className="space-y-2">
                                            <label className="block text-gray-300 text-sm font-bold">Options:</label>
                                            {['A', 'B', 'C', 'D'].map((letter, oIndex) => (
                                                <div key={oIndex} className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name={`correct-option-${qIndex}`}
                                                        checked={q.options[oIndex]?.isCorrect || false}
                                                        onChange={() => handleCorrectOptionChange(qIndex, oIndex)}
                                                        className="form-radio text-blue-500"
                                                    />
                                                    <Input
                                                        type="text"
                                                        value={q.options[oIndex]?.text || ''}
                                                        onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                                        placeholder={`Option ${letter}`}
                                                        required
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <Textarea
                                            id={`question-${qIndex}-explanation`}
                                            label="Explanation"
                                            value={q.explanation}
                                            onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                                            rows="2"
                                            placeholder="Provide a brief explanation for the correct answer."
                                            required
                                        />
                                    </div>
                                ))}
                                <Button type="button" onClick={handleAddQuestion} icon={PlusCircle} className="w-full bg-green-600 hover:bg-green-700 text-sm">
                                    Add Question
                                </Button>
                                <Button type="submit" disabled={isCreatingAssessment} className="w-full bg-blue-600 hover:bg-blue-700 mt-4">
                                    {isCreatingAssessment ? 'Creating Assessment...' : 'Create Assessment'}
                                </Button>
                            </form>
                        </div>

                        {/* Content List */}
                        <div className="mt-6">
                            <h4 className="text-xl font-semibold text-white mb-4">Existing Content</h4>
                            {content.length === 0 ? (
                                <p className="text-gray-400">No content added yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                                        <thead className="bg-gray-600">
                                            <tr>
                                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Title</th>
                                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Type</th>
                                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Category</th>
                                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Content Source</th> {/* Changed header */}
                                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {content.map((item) => (
                                                <tr key={item.id} className="border-t border-gray-600 hover:bg-gray-600">
                                                    <td className="py-3 px-4 text-gray-300">{item.title}</td>
                                                    <td className="py-3 px-4 text-gray-300">{item.type}</td>
                                                    <td className="py-3 px-4 text-gray-300">{item.category}</td>
                                                    <td className="py-3 px-4">
                                                        {item.contentUrl ? (
                                                            <a href={item.contentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate w-32 block">
                                                                {item.contentUrl}
                                                            </a>
                                                        ) : item.moduleContent ? ( // Check for moduleContent
                                                            <span className="text-gray-400">Manual Content</span>
                                                        ) : item.type === 'assessment' && item.questions ? ( // Check for manual assessment questions
                                                            <span className="text-gray-400">Manual Assessment</span>
                                                        ) : (
                                                            <span className="text-gray-400">AI Generated</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Button onClick={() => deleteContent(item.id)} icon={XCircle} className="bg-red-600 hover:bg-red-700 text-xs">
                                                            Delete
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                    <hr className="my-6 border-gray-700" />

                    {/* Settings Section (Placeholder) */}
                    <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700" id="settings">
                        <h3 className="text-2xl font-bold mb-4 text-indigo-300 flex items-center gap-2">
                            <Settings size={24} /> Admin Settings
                        </h3>
                        <p className="text-gray-400">Manage application-wide settings here (e.g., API keys, default roles).</p>
                    </div>
                </div>
            </main>
            {showMessageBox && (
                <MessageBox message={message} type={messageType} onConfirm={() => setShowMessageBox(false)} />
            )}

            {showUserDetailsModal && selectedUser && (
                <UserDetailsModal
                    user={selectedUser}
                    onClose={() => setShowUserDetailsModal(false)}
                    employeeSkills={selectedUser.skills || []}
                    targetRoleSkills={[]}
                    roleName={null}
                />
            )}

            {showUserDetailsModal && selectedUser && (
                <UserDetailsModal
                    user={selectedUser}
                    onClose={() => setShowUserDetailsModal(false)}
                    recommendedRoleName={null}
                />
            )}

            {showRecommendedEmployeeDetailsModal && selectedRecommendedEmployee && (
                <UserDetailsModal
                    user={selectedRecommendedEmployee}
                    onClose={() => setShowRecommendedEmployeeDetailsModal(false)}
                    recommendedRoleName={selectedRecommendedEmployee.recommendedRoleName}
                />
            )}
        </div>
    );
};

// --- AddContentForm Component ---
const AddContentForm = ({ db, appId, setMessage, setMessageType, setShowMessageBox }) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('module'); // Default to module
    const [category, setCategory] = useState('');
    const [contentUrl, setContentUrl] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAddContent = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setShowMessageBox(false);

        try {
            if (!title || !type || !category) { // contentUrl is optional for AI-generated
                setMessage('Please fill in all required fields (Title, Type, Category).');
                setMessageType('error');
                setShowMessageBox(true);
                setIsLoading(false);
                return;
            }

            await setDoc(doc(collection(db, `artifacts/${appId}/content`)), {
                title,
                type,
                category,
                contentUrl: contentUrl || null, // Allow null if not provided
                description,
                createdAt: new Date(),
            });

            setMessage('Content added successfully!');
            setMessageType('success');
            setShowMessageBox(true);
            // Clear form
            setTitle('');
            setType('module');
            setCategory('');
            setContentUrl('');
            setDescription('');
        } catch (error) {
            console.error("Error adding content:", error);
            setMessage(`Failed to add content: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-700 p-6 rounded-lg shadow-inner mb-6">
            <h4 className="text-xl font-semibold text-white mb-4">Add New Learning Content</h4>
            <form onSubmit={handleAddContent} className="space-y-4">
                <Input
                    id="contentTitle"
                    label="Title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Introduction to React, Advanced Python"
                    required
                />
                <Select
                    id="contentType"
                    label="Content Type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    options={[
                        { value: 'module', label: 'Module' },
                        { value: 'assessment', label: 'Assessment' },
                        { value: 'resource', label: 'Resource' },
                    ]}
                    required
                />
                <Input
                    id="contentCategory"
                    label="Category"
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Programming, Soft Skills, Data Science"
                    required
                />
                <Input
                    id="contentUrl"
                    label="Content URL (Optional, for external links)"
                    type="url"
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                    placeholder="https://example.com/content-link"
                />
                <Textarea
                    id="contentDescription"
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the content"
                    rows="3"
                />
                <Button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700">
                    {isLoading ? 'Adding Content...' : 'Add Content'}
                </Button>
            </form>
        </div>
    );
};

// --- ContentList Component ---
const ContentList = ({ content, deleteContent }) => {
    return (
        <div className="mt-6">
            <h4 className="text-xl font-semibold text-white mb-4">Existing Content</h4>
            {content.length === 0 ? (
                <p className="text-gray-400">No content added yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                        <thead className="bg-gray-600">
                            <tr>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Title</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Type</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Category</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">URL</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {content.map((item) => (
                                <tr key={item.id} className="border-t border-gray-600 hover:bg-gray-600">
                                    <td className="py-3 px-4 text-gray-300">{item.title}</td>
                                    <td className="py-3 px-4 text-gray-300">{item.type}</td>
                                    <td className="py-3 px-4 text-gray-300">{item.category}</td>
                                    <td className="py-3 px-4">
                                        {item.contentUrl ? (
                                            <a href={item.contentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate w-32 block">
                                                {item.contentUrl}
                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400">AI Generated</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Button onClick={() => deleteContent(item.id)} icon={XCircle} className="bg-red-600 hover:bg-red-700 text-xs">
                                                            Delete
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                };

const Assessment = ({ setCurrentPage }) => {
    // Directly use geminiApiKey from useFirebase hook
    const { userId, db, isAuthReady, geminiApiKey, appId } = useFirebase();

    // State for pre-defined assessments (if any fetched from Firebase)
    const [assessments, setAssessments] = useState([]);
    // State for the topic of the assessment (for dynamic generation)
    const [assessmentTopic, setAssessmentTopic] = useState('');
    // State for generated MCQ questions
    const [generatedQuestions, setGeneratedQuestions] = useState([]);
    // State for the currently selected pre-defined assessment
    const [currentAssessment, setCurrentAssessment] = useState(null);
    // State to store user's answers for MCQ questions
    const [answers, setAnswers] = useState({});
    // State for the calculated score of an MCQ assessment
    const [score, setScore] = useState(null);
    // State for displaying messages to the user (e.g., success, error)
    const [message, setMessage] = useState('');
    // State for the type of message ('info', 'success', 'error')
    const [messageType, setMessageType] = useState('info');
    // State to control the visibility of the message box
    const [showMessageBox, setShowMessageBox] = useState(false);
    // State for general loading (e.g., fetching Firebase data)
    const [isLoading, setIsLoading] = useState(true);
    // State specifically for loading during Gemini API calls (generation)
    const [isGenerating, setIsGenerating] = useState(false);
    // State to control visibility of explanations after MCQ submission
    const [showExplanations, setShowExplanations] = useState(false);
    // State to trigger confetti effect
    const [showConfetti, setShowConfetti] = useState(false);

    // NEW STATES FOR CODING CHALLENGE
    // State to determine the type of assessment: 'mcq' or 'coding'
    const [assessmentType, setAssessmentType] = useState('mcq');
    // State to hold the generated coding challenge problem
    const [challengeProblem, setChallengeProblem] = useState(null);
    // State to store the user's submitted code for evaluation
    const [userCode, setUserCode] = useState('');
    // State to store the result of code evaluation by Gemini
    const [codeEvaluationResult, setCodeEvaluationResult] = useState(null);
    // State specifically for loading during code evaluation
    const [isEvaluatingCode, setIsEvaluatingCode] = useState(false);
    // State for the selected programming language for coding challenges (user input)
    const [challengeLanguage, setChallengeLanguage] = useState('');
    // State for the selected difficulty of coding challenges
    const [challengeDifficulty, setChallengeDifficulty] = useState('Medium');

    // NEW STATE FOR MULTIPLE CHALLENGES
    // State to hold a set of generated coding challenges
    const [generatedChallenges, setGeneratedChallenges] = useState([]);
    // State for loading during generation of multiple challenges
    const [isGeneratingMultiple, setIsGeneratingMultiple] = useState(false);

    // useEffect hook to handle initial data loading and authentication check
    useEffect(() => {
        // Redirect to auth page if user is not authenticated and auth state is ready
        if (isAuthReady && !userId) {
            setCurrentPage('auth');
            return;
        }

        // Fetch pre-defined assessments from Firebase once authenticated and db is available
        if (isAuthReady && db) {
            // Collection reference for content, specifically assessments
            const assessmentsColRef = collection(db, `artifacts/${appId}/content`);
            // Query to filter for documents where 'type' field is 'assessment'
            const q = query(assessmentsColRef, where("type", "==", "assessment"));
            // Set up a real-time listener for changes in the assessments collection
            const unsubscribe = onSnapshot(q, (snapshot) => {
                // Map document data to state, including the document ID
                setAssessments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false); // Data loaded, stop general loading indicator
            }, (error) => {
                // Handle errors during data fetching
                console.error("Error fetching assessments:", error);
                setMessage('Failed to load pre-defined assessments.');
                setMessageType('error');
                setShowMessageBox(true);
                setIsLoading(false); // Stop loading even on error
            });
            // Cleanup function to unsubscribe from the real-time listener when component unmounts
            return () => unsubscribe();
        }
    }, [isAuthReady, userId, db, setCurrentPage, appId]); // Dependencies for this useEffect

    // useEffect hook to trigger confetti animation
    useEffect(() => {
        if (showConfetti) {
            // Burst from center
            confetti({
                particleCount: 150, // Increased particles for a more vibrant effect
                spread: 90,        // Wider spread
                origin: { y: 0.6 } // Slightly above center vertically
            });

            // Burst from bottom-left
            setTimeout(() => {
                confetti({
                    particleCount: 100,
                    angle: 45, // Angle towards top-right
                    spread: 70,
                    origin: { x: 0, y: 1 } // From bottom-left corner
                });
            }, 200); // Small delay

            // Burst from bottom-right
            setTimeout(() => {
                confetti({
                    particleCount: 100,
                    angle: 135, // Angle towards top-left
                    spread: 70,
                    origin: { x: 1, y: 1 } // From bottom-right corner
                });
            }, 400); // Small delay

            // Another burst from the top-center, slightly delayed
            setTimeout(() => {
                confetti({
                    particleCount: 80,
                    spread: 120,
                    origin: { y: 0.2 } // From top-center
                });
            }, 600);

            // Reset confetti state after a short delay to allow re-triggering
            const timer = setTimeout(() => {
                setShowConfetti(false);
            }, 3000); // Confetti lasts for 3 seconds

            return () => clearTimeout(timer); // Cleanup timer on unmount or re-render
        }
    }, [showConfetti]); // Dependency: re-run when showConfetti changes

    /**
     * Starts a pre-defined assessment.
     * @param {string} assessmentId - The ID of the assessment to start.
     */
    const startAssessment = (assessmentId) => {
        const assessment = assessments.find(a => a.id === assessmentId);
        if (assessment) {
            setCurrentAssessment(assessment); // Set the current assessment
            setAnswers({}); // Clear previous answers
            setScore(null); // Clear previous score
            setGeneratedQuestions([]); // Clear any previously generated questions
            setShowExplanations(false); // Reset explanations view for new assessment
            setAssessmentType('mcq'); // Ensure type is MCQ for pre-defined assessments
        }
    };

    /**
     * Generates a dynamic MCQ assessment using the Gemini API.
     */
    const generateAssessment = async () => {
        // Validate input and API key
        if (!assessmentTopic.trim()) {
            setMessage('Please enter a topic to generate an assessment.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }
        if (!geminiApiKey) { // Directly use geminiApiKey from useFirebase hook
            setMessage('Gemini API key is not configured. Cannot generate assessments.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }

        setIsGenerating(true); // Start generation loading indicator
        setGeneratedQuestions([]); // Clear previous questions
        setAnswers({}); // Clear previous answers
        setScore(null); // Clear previous score
        setCurrentAssessment(null); // Clear pre-defined assessment if any
        setShowExplanations(false); // Reset explanations view
        setChallengeProblem(null); // Clear coding challenge if any
        setGeneratedChallenges([]); // Clear multiple challenges
        setMessage(`Generating assessment on "${assessmentTopic}"...`);
        setMessageType('info');
        setShowMessageBox(true);

        // Prompt for Gemini API to generate MCQ questions
        const prompt = `Generate a 20-question multiple-choice assessment on "${assessmentTopic}". Each question should have a question text, exactly 4 distinct options (labeled A, B, C, D), clearly specify the correct option letter, and **provide a concise explanation for the correct answer**. Ensure the questions are relevant to the topic and vary in difficulty.

        IMPORTANT: The 'options' array should ONLY contain the option text, WITHOUT the leading A., B., C., D. labels. The correct option letter should be in the 'correctAnswer' field.

        Respond in a JSON array of objects. Each object should have:
        - "questionText": string
        - "options": array of 4 strings (e.g., ["Option 1 Text", "Option 2 Text", "Option 3 Text", "Option 4 Text"])
        - "correctAnswer": string (the correct option letter, e.g., "A", "B", "C", or "D")
        - "explanation": string (concise explanation for the correct answer)
        `;

        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.7, // Adjust temperature for creativity/randomness
                responseMimeType: "application/json", // Expect JSON response
                responseSchema: { // Define expected JSON schema for validation
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "questionText": { "type": "STRING" },
                            "options": {
                                "type": "ARRAY",
                                "items": { "type": "STRING" },
                                "minItems": 4,
                                "maxItems": 4
                            },
                            "correctAnswer": { "type": "STRING" },
                            "explanation": { "type": "STRING" }
                        },
                        required: ["questionText", "options", "correctAnswer", "explanation"]
                    }
                }
            },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 2000; // 2 seconds

        // Implement exponential backoff for API calls
        while (retries < maxRetries) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 429) { // Rate limit hit
                    const delay = baseDelay * Math.pow(2, retries);
                    console.warn(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                    await new Promise(res => setTimeout(res, delay));
                    retries++;
                    continue; // Retry the request
                }

                if (!response.ok) { // Other HTTP errors
                    const errorBody = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody.error?.message || 'Unknown error'}`);
                }

                const result = await response.json();
                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const jsonString = result.candidates[0].content.parts[0].text;
                    const parsedQuestions = JSON.parse(jsonString);

                    if (parsedQuestions.length > 0) {
                        setGeneratedQuestions(parsedQuestions);
                        setMessage('Assessment generated successfully!');
                        setMessageType('success');
                    } else {
                        setMessage('Gemini generated an empty assessment. Please try a different topic.');
                        setMessageType('error');
                    }
                } else {
                    setMessage('Failed to generate assessment: No valid response from API.');
                    setMessageType('error');
                }
                break; // Exit loop on success or non-retryable error
            } catch (error) {
                console.error("Error generating assessment with Gemini:", error);
                setMessage(`Failed to generate assessment: ${error.message}. Please try again.`);
                setMessageType('error');
                break; // Exit loop on error
            } finally {
                setIsGenerating(false); // Stop loading indicator
                setShowMessageBox(true); // Show message box
            }
        }
        if (retries === maxRetries) { // If all retries failed
            setMessage('Failed to generate assessment after multiple retries due to rate limiting or persistent error.');
            setMessageType('error');
            setShowMessageBox(true);
            setIsGenerating(false);
        }
    };

    /**
     * Generates a single coding challenge using the Gemini API.
     */
    const generateCodingChallenge = async () => {
        // Validate input and API key
        if (!challengeLanguage.trim() || !challengeDifficulty.trim()) {
            setMessage('Please specify a programming language and difficulty.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }
        if (!geminiApiKey) {
            setMessage('Gemini API key is not configured. Cannot generate coding challenges.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }

        setIsGenerating(true); // Start loading indicator
        setChallengeProblem(null); // Clear previous challenge
        setUserCode(''); // Clear user code
        setCodeEvaluationResult(null); // Clear previous evaluation result
        setGeneratedQuestions([]); // Clear MCQ questions
        setCurrentAssessment(null); // Clear pre-defined assessment
        setGeneratedChallenges([]); // Clear multiple challenges if any

        // Determine the topic for the prompt (optional)
        const selectedTopic = assessmentTopic.trim();
        const topicInstruction = selectedTopic
            ? `on the topic of "${selectedTopic}"`
            : `on a diverse and interesting topic (e.g., data structures, algorithms, string manipulation, recursion, object-oriented programming)`;

        setMessage(`Generating a ${challengeDifficulty} ${challengeLanguage} coding challenge ${topicInstruction}...`);
        setMessageType('info');
        setShowMessageBox(true);

        // Prompt for Gemini API to generate coding challenge
        const prompt = `Generate a ${challengeDifficulty} difficulty coding challenge problem ${topicInstruction} in ${challengeLanguage}.
        The problem should include:
        1. A clear problem statement.
        2. Input constraints.
        3. Output format.
        4. At least 2-3 example test cases with input and expected output.
        5. The problem statement should be concise and clear.

        IMPORTANT: The response MUST be a raw JSON object. Do NOT include any markdown formatting (like \`\`\`json) or any extra text before or after the JSON.
        The JSON structure MUST be exactly as follows:
        {
          "title": "string",
          "problemStatement": "string",
          "language": "string",
          "difficulty": "string",
          "testCases": [
            { "input": "string", "expectedOutput": "string" }
          ]
        }`;

        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "title": { "type": "STRING" },
                        "problemStatement": { "type": "STRING" },
                        "language": { "type": "STRING" },
                        "difficulty": { "type": "STRING" },
                        "testCases": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "input": { "type": "STRING" },
                                    "expectedOutput": { "type": "STRING" }
                                }
                            }
                        }
                    },
                    required: ["title", "problemStatement", "language", "difficulty", "testCases"]
                }
            },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 2000;

        while (retries < maxRetries) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 429) {
                    const delay = baseDelay * Math.pow(2, retries);
                    console.warn(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                    await new Promise(res => setTimeout(res, delay));
                    retries++;
                    continue;
                }

                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody.error?.message || 'Unknown error'}`);
                }

                const result = await response.json();
                const text = result.candidates[0].content.parts[0].text; // Get the raw text from the model
                console.log("Raw Gemini response for challenge generation:", text); // Log raw text for debugging

                let parsedProblem;
                try {
                    // Robust JSON parsing: find the first and last curly braces to extract the JSON block
                    const firstBrace = text.indexOf('{');
                    const lastBrace = text.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        const jsonString = text.substring(firstBrace, lastBrace + 1);
                        parsedProblem = JSON.parse(jsonString);
                    } else {
                        throw new Error("No valid JSON object found in response.");
                    }
                } catch (jsonError) {
                    console.error("Failed to parse Gemini response as JSON:", jsonError, "Raw text:", text);
                    setMessage('Failed to parse challenge. Gemini returned invalid JSON. Please try again.');
                    setMessageType('error');
                    setIsGenerating(false);
                    setShowMessageBox(true);
                    return; // Exit here if parsing fails
                }

                setChallengeProblem(parsedProblem);
                setMessage('Coding challenge generated successfully!');
                setMessageType('success');
                break;
            } catch (error) {
                console.error("Error generating coding challenge:", error);
                setMessage(`Failed to generate coding challenge: ${error.message}`);
                setMessageType('error');
                break;
            } finally {
                setIsGenerating(false);
                setShowMessageBox(true);
            }
        }
        if (retries === maxRetries) {
            setMessage('Failed to generate coding challenge after multiple retries.');
            setMessageType('error');
            setShowMessageBox(true);
            setIsGenerating(false);
        }
    };

    /**
     * Generates multiple coding challenges based on specified counts per difficulty.
     * @param {object} counts - An object specifying the number of challenges for each difficulty (e.g., { Easy: 3, Medium: 2, Hard: 1 }).
     */
    const generateMultipleChallenges = async (counts = { Easy: 3, Medium: 2, Hard: 1 }) => {
        // Validate input and API key
        if (!challengeLanguage.trim()) {
            setMessage('Please specify a programming language for the challenges.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }
        if (!geminiApiKey) {
            setMessage('Gemini API key is not configured. Cannot generate challenges.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }

        setIsGeneratingMultiple(true); // Start loading indicator for multiple generations
        setGeneratedChallenges([]); // Clear previous challenges
        setChallengeProblem(null); // Clear single challenge view
        setGeneratedQuestions([]); // Clear MCQ questions
        setCurrentAssessment(null); // Clear pre-defined assessment
        setMessage('Generating multiple coding challenges...');
        setMessageType('info');
        setShowMessageBox(true);

        const allGenerated = [];
        const difficulties = Object.keys(counts);

        // Loop through each difficulty and generate the specified number of challenges
        for (const difficulty of difficulties) {
            for (let i = 0; i < counts[difficulty]; i++) {
                // Determine the topic for the prompt (optional)
                const topicInstruction = assessmentTopic.trim()
                    ? `on the topic of "${assessmentTopic.trim()}"`
                    : `on a diverse and interesting topic (e.g., data structures, algorithms, string manipulation, recursion)`;

                // Prompt for Gemini API
                const prompt = `Generate a ${difficulty} difficulty coding challenge problem ${topicInstruction} in ${challengeLanguage}.
                The problem should include:
                1. A clear problem statement.
                2. Input constraints.
                3. Output format.
                4. At least 2-3 example test cases with input and expected output.
                5. The problem statement should be concise and clear.

                IMPORTANT: The response MUST be a raw JSON object. Do NOT include any markdown formatting (like \`\`\`json) or any extra text before or after the JSON.
                The JSON structure MUST be exactly as follows:
                {
                  "title": "string",
                  "problemStatement": "string",
                  "language": "string",
                  "difficulty": "string",
                  "testCases": [
                    { "input": "string", "expectedOutput": "string" }
                  ]
                }`;

                const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
                const payload = {
                    contents: chatHistory,
                    generationConfig: {
                        temperature: 0.7,
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                "title": { "type": "STRING" },
                                "problemStatement": { "type": "STRING" },
                                "language": { "type": "STRING" },
                                "difficulty": { "type": "STRING" },
                                "testCases": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "input": { "type": "STRING" },
                                            "expectedOutput": { "type": "STRING" }
                                        }
                                    }
                                }
                            },
                            required: ["title", "problemStatement", "language", "difficulty", "testCases"]
                        }
                    }
                };

                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

                let retries = 0;
                const maxRetries = 3;
                const baseDelay = 2000;

                while (retries < maxRetries) {
                    try {
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (response.status === 429) {
                            const delay = baseDelay * Math.pow(2, retries);
                            console.warn(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                            await new Promise(res => setTimeout(res, delay));
                            retries++;
                            continue;
                        }

                        if (!response.ok) {
                            const errorBody = await response.json();
                            throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody.error?.message || 'Unknown error'}`);
                        }

                        const result = await response.json();
                        const text = result.candidates[0].content.parts[0].text;
                        console.log(`Raw Gemini response for ${difficulty} challenge ${i+1}:`, text);

                        let parsedProblem;
                        try {
                            const firstBrace = text.indexOf('{');
                            const lastBrace = text.lastIndexOf('}');
                            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                                const jsonString = text.substring(firstBrace, lastBrace + 1);
                                parsedProblem = JSON.parse(jsonString);
                            } else {
                                throw new Error("No valid JSON object found in response.");
                            }
                        } catch (jsonError) {
                            console.error(`Failed to parse JSON for ${difficulty} challenge ${i+1}:`, jsonError, "Raw text:", text);
                            // Log warning and continue if one challenge fails to parse
                            setMessage(`Failed to parse one or more challenges. Some may be missing.`);
                            setMessageType('warning');
                            setShowMessageBox(true);
                            break; // Exit retry loop for this specific challenge
                        }
                        allGenerated.push(parsedProblem); // Add successfully parsed challenge
                        break; // Exit retry loop for this specific challenge on success
                    } catch (error) {
                        console.error(`Error generating ${difficulty} challenge ${i+1}:`, error);
                        setMessage(`Failed to generate one or more challenges: ${error.message}.`);
                        setMessageType('error');
                        setShowMessageBox(true);
                        break; // Exit retry loop for this specific challenge on error
                    }
                }
            }
        }

        setGeneratedChallenges(allGenerated); // Update state with all generated challenges
        if (allGenerated.length > 0) {
            setMessage(`Generated ${allGenerated.length} coding challenges.`);
            setMessageType('success');
        } else {
            setMessage('No coding challenges could be generated.');
            setMessageType('error');
        }
        setIsGeneratingMultiple(false); // Stop loading indicator
        setShowMessageBox(true); // Show message box
    };

    /**
     * Submits the user's code for a coding challenge to Gemini for evaluation.
     */
    const submitCodingChallenge = async () => {
        // Validate input and API key
        if (!challengeProblem || !userCode.trim()) {
            setMessage('Please generate a challenge and write your code first.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }
        if (!geminiApiKey) {
            setMessage('Gemini API key is not configured. Cannot evaluate code.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }

        setIsEvaluatingCode(true); // Start loading indicator for evaluation
        setCodeEvaluationResult(null); // Clear previous evaluation result
        setMessage('Evaluating your code, please wait...');
        setMessageType('info');
        setShowMessageBox(true);

        // Prompt for Gemini API to evaluate code
        const evaluationPrompt = `
        You are an automated code judge. Evaluate the following user-submitted code for a coding challenge.
        
        Coding Challenge Problem:
        Title: ${challengeProblem.title}
        Problem Statement: ${challengeProblem.problemStatement}
        Language: ${challengeProblem.language}
        Difficulty: ${challengeProblem.difficulty}
        Test Cases:
        ${challengeProblem.testCases.map(tc => `Input: ${tc.input}\nExpected Output: ${tc.expectedOutput}`).join('\n\n')}

        User Submitted Code (${challengeProblem.language}):
        \`\`\`${challengeProblem.language.toLowerCase()}
        ${userCode}
        \`\`\`

        Based on the problem statement and test cases, determine if the user's code is logically correct and produces the expected output for the given test cases. Provide a concise evaluation in JSON format.
        Additionally, identify the **specific error(s)** the user made and provide **clear, actionable correction steps or a corrected code snippet**.

        The JSON structure MUST be exactly as follows:
        {
          "overallFeedback": "string (e.g., 'Correct', 'Partially Correct', 'Incorrect')",
          "score": "number (0-100, based on correctness and efficiency)",
          "testCaseResults": [
            { "input": "string", "expected": "string", "actual": "string (Gemini's predicted output)", "passed": "boolean", "feedback": "string" }
          ],
          "suggestionsForImprovement": "string (e.g., 'Consider edge cases', 'Improve efficiency')",
          "identifiedError": "string (description of the user's error)",
          "correctionNeeded": "string (actionable steps or corrected code snippet)"
        }
        IMPORTANT: The response MUST be a raw JSON object. Do NOT include any markdown formatting (like \`\`\`json) or any extra text before or after the JSON.
        `;

        const chatHistory = [{ role: "user", parts: [{ text: evaluationPrompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.5, // Lower temperature for more deterministic/factual output
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "overallFeedback": { "type": "STRING" },
                        "score": { "type": "NUMBER" },
                        "testCaseResults": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "input": { "type": "STRING" },
                                    "expected": { "type": "STRING" },
                                    "actual": { "type": "STRING" },
                                    "passed": { "type": "BOOLEAN" },
                                    "feedback": { "type": "STRING" }
                                }
                            }
                        },
                        "suggestionsForImprovement": { "type": "STRING" },
                        "identifiedError": { "type": "STRING" },
                        "correctionNeeded": { "type": "STRING" }
                    },
                    required: ["overallFeedback", "score", "testCaseResults", "suggestionsForImprovement", "identifiedError", "correctionNeeded"]
                }
            },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 2000;

        while (retries < maxRetries) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 429) {
                    const delay = baseDelay * Math.pow(2, retries);
                    console.warn(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                    await new Promise(res => setTimeout(res, delay));
                    retries++;
                    continue;
                }

                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody.error?.message || 'Unknown error'}`);
                }

                const result = await response.json();
                const text = result.candidates[0].content.parts[0].text; // Get the raw text from the model
                console.log("Raw Gemini response for evaluation:", text); // Log raw text for debugging

                let parsedEvaluation;
                try {
                    // Robust JSON parsing: find the first and last curly braces to extract the JSON block
                    const firstBrace = text.indexOf('{');
                    const lastBrace = text.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        const jsonString = text.substring(firstBrace, lastBrace + 1);
                        parsedEvaluation = JSON.parse(jsonString);
                    } else {
                        throw new Error("No valid JSON object found in response.");
                    }
                } catch (jsonError) {
                    console.error("Failed to parse Gemini response as JSON:", jsonError, "Raw text:", text);
                    setMessage('Failed to parse evaluation. Gemini returned invalid JSON. Please try again.');
                    setMessageType('error');
                    setIsEvaluatingCode(false);
                    setShowMessageBox(true);
                    return; // Exit here if parsing fails
                }

                setCodeEvaluationResult(parsedEvaluation);
                setMessage('Code evaluation complete!');
                setMessageType('success');
                // Trigger confetti if code evaluation is successful (e.g., for a good score)
                if (parsedEvaluation.score >= 80) { // Example condition for confetti on good score
                    setShowConfetti(true);
                }
                break;
            } catch (error) {
                console.error("Error evaluating code:", error);
                setMessage(`Failed to evaluate code: ${error.message}`);
                setMessageType('error');
                break;
            } finally {
                setIsEvaluatingCode(false);
                setShowMessageBox(true);
            }
        }
        if (retries === maxRetries) {
            setMessage('Failed to evaluate code after multiple retries.');
            setMessageType('error');
            setShowMessageBox(true);
            setIsEvaluatingCode(false);
        }
    };

    /**
     * Handles changes in user's answers for MCQ questions.
     * @param {number} questionIndex - The index of the question.
     * @param {string} value - The selected answer value.
     */
    const handleAnswerChange = (questionIndex, value) => {
        setAnswers(prev => ({ ...prev, [questionIndex]: value }));
    };

    /**
     * Converts an option index to its corresponding letter (A, B, C, D).
     * @param {number} index - The zero-based index of the option.
     * @returns {string} The option letter.
     */
    const getOptionLetter = (index) => String.fromCharCode(65 + index); // A, B, C, D

    /**
     * Submits the completed MCQ assessment, calculates score, and saves results to Firebase.
     */
    const submitAssessment = async () => {
        if ((!generatedQuestions.length && !currentAssessment) || !userId || !db) return;

        setIsLoading(true);
        setShowMessageBox(false);
        setShowExplanations(true); // Show explanations after submission

        let calculatedScore = 0;
        // Determine which set of questions to score (dynamically generated or pre-defined)
        let questionsToScore = generatedQuestions.length > 0 ? generatedQuestions : (currentAssessment?.questions || []);
        const totalQuestions = questionsToScore.length;

        // Create a structure to store correctness for review and attach explanations
        const reviewedQuestions = questionsToScore.map((q, index) => {
            const userAnswer = answers[index];
            let isCorrect = false;
            let correctAnswerValue = '';
            let explanation = '';

            if (generatedQuestions.length > 0) {
                // For dynamically generated MCQ questions
                const correctAnswerLetter = q.correctAnswer;
                isCorrect = (userAnswer === correctAnswerLetter);
                // Get the actual text of the correct option
                correctAnswerValue = q.options[correctAnswerLetter.charCodeAt(0) - 65];
                explanation = q.explanation; // Get explanation from generated question
            } else if (currentAssessment) {
                // For pre-defined assessments (assuming they also have 'correctAnswer' and 'explanation')
                isCorrect = (q.correctAnswer && userAnswer === q.correctAnswer);
                correctAnswerValue = q.correctAnswer;
                explanation = q.explanation || 'No explanation provided for this question.';
            }

            if (isCorrect) {
                calculatedScore++; // Increment score if answer is correct
            }

            return {
                ...q, // Spread original question properties
                userAnswer: userAnswer, // User's selected answer
                isCorrect: isCorrect, // Whether user's answer was correct
                correctAnswerValue: correctAnswerValue, // Actual text of the correct answer
                explanation: explanation // Explanation for the correct answer
            };
        });

        // Calculate percentage score
        const percentageScore = totalQuestions > 0 ? (calculatedScore / totalQuestions) * 100 : 0;
        setScore(percentageScore);

        // Update the questions state with the reviewedQuestions (including correctness and explanation)
        if (generatedQuestions.length > 0) {
            setGeneratedQuestions(reviewedQuestions);
        } else if (currentAssessment) {
            setCurrentAssessment(prev => ({ ...prev, questions: reviewedQuestions }));
        }

        try {
            // Determine assessment title and ID for saving to Firebase
            const assessmentTitle = generatedQuestions.length > 0 ? `Dynamic Assessment: ${assessmentTopic}` : currentAssessment.title;
            const assessmentId = generatedQuestions.length > 0 ? `dynamic-${Date.now()}` : currentAssessment.id;

            // Save user's assessment results to Firestore
            const userAssessmentDocRef = doc(db, `artifacts/${appId}/users/${userId}/assessments/${assessmentId}`);
            await setDoc(userAssessmentDocRef, {
                assessmentId: assessmentId,
                title: assessmentTitle,
                score: percentageScore,
                completedAt: new Date(),
                answers: answers, // Save user's raw answers
                questions: reviewedQuestions, // Save questions with review details
            });

            // Update user points and workflow progress in their profile
            const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
            const profileSnap = await getDoc(userProfileRef);
            let profileData = profileSnap.exists() ? profileSnap.data() : {};
            let currentPoints = profileData.points || 0;
            let currentWorkflowProgress = profileData.workflowProgress || 0;
            let currentSkills = profileData.skills || [];

            // Calculate points earned based on score
            const pointsEarned = Math.round(percentageScore / 5); // Max 20 points for 100%

            // Update skill proficiency based on assessment topic
            const topicAsSkillName = assessmentTopic.trim() || (currentAssessment?.title || 'General Knowledge');
            let skillFound = false;
            const updatedSkills = currentSkills.map(skill => {
                if (skill.name.toLowerCase() === topicAsSkillName.toLowerCase()) {
                    skillFound = true;
                    let newLevel = skill.level;
                    if (percentageScore >= 80) {
                        newLevel = Math.min(5, skill.level + 1); // Increase level for high score
                    } else if (percentageScore < 60) {
                        newLevel = Math.max(1, skill.level - 0.5); // Decrease for low score
                    }
                    return { ...skill, level: newLevel };
                }
                return skill;
            });

            if (!skillFound) {
                // Add new skill if not found
                let initialLevel = 1;
                if (percentageScore >= 80) initialLevel = 4;
                else if (percentageScore >= 60) initialLevel = 3;
                else if (percentageScore >= 40) initialLevel = 2;
                updatedSkills.push({ name: topicAsSkillName, level: initialLevel });
            }

            // Perform the update operation
            await updateDoc(userProfileRef, {
                points: currentPoints + pointsEarned,
                workflowProgress: Math.min(100, currentWorkflowProgress + 10), // Increment progress
                skills: updatedSkills, // Update skills array
            });

            // 🎉 FIXED: Trigger confetti celebration effect for good scores!
            if (percentageScore >= 70) { // Only show confetti for scores 70% or higher
                setShowConfetti(true);
            }

            setMessage(`Assessment completed! Your score: ${percentageScore.toFixed(2)}%. Your skill in "${topicAsSkillName}" has been updated.`);
            setMessageType('success');
            setShowMessageBox(true);
        } catch (error) {
            console.error("Error submitting assessment:", error);
            setMessage(`Failed to submit assessment: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        } finally {
            setIsLoading(false); // Stop loading indicator
        }
    };

    // Show loading page if initial Firebase data is still loading
    if (isLoading && !isGenerating && !isEvaluatingCode && !isGeneratingMultiple) {
        return <LoadingPage message="Loading assessments..." />;
    }

    // Determine which questions/challenge to display based on current state
    const currentQuestions = generatedQuestions.length > 0 ? generatedQuestions : (currentAssessment?.questions || []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col font-inter">
            {/* Header section with title and back button */}
            <header className="flex justify-between items-center p-6 bg-gray-900 shadow-lg border-b border-gray-700">
                <h1 className="text-3xl font-extrabold text-blue-400">Skill Assessments</h1>
                <Button onClick={() => setCurrentPage('dashboard')} icon={Home} className="bg-gray-700 hover:bg-gray-600 focus:ring-blue-500">
                    Back to Dashboard
                </Button>
            </header>

            {/* Main content area */}
            <main className="flex-grow p-6 flex justify-center items-start">
                <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700 w-full max-w-4xl">
                    <h2 className="text-2xl font-bold mb-6 text-gray-200 text-center">Assessment Module</h2>

                    {/* Assessment Type Selection Buttons */}
                    <div className="flex justify-center mb-8 gap-4">
                        <Button
                            onClick={() => {
                                setAssessmentType('mcq');
                                setChallengeProblem(null);
                                setGeneratedQuestions([]);
                                setCurrentAssessment(null);
                                setScore(null);
                                setShowExplanations(false);
                                setAssessmentTopic('');
                                setGeneratedChallenges([]);
                                setCodeEvaluationResult(null); // Clear code evaluation results
                                setUserCode(''); // Clear user code
                            }}
                            className={`${assessmentType === 'mcq' ? 'bg-blue-600 shadow-lg shadow-blue-500/50' : 'bg-gray-700'} hover:bg-blue-700 transition-all duration-300 transform hover:scale-105`}
                        >
                            Multiple Choice Questions
                        </Button>
                        <Button
                            onClick={() => {
                                setAssessmentType('coding');
                                setGeneratedQuestions([]);
                                setCurrentAssessment(null);
                                setScore(null);
                                setShowExplanations(false);
                                setAssessmentTopic('');
                                setChallengeProblem(null);
                                setGeneratedChallenges([]);
                                setCodeEvaluationResult(null); // Clear code evaluation results
                                setUserCode(''); // Clear user code
                            }}
                            className={`${assessmentType === 'coding' ? 'bg-purple-600 shadow-lg shadow-purple-500/50' : 'bg-gray-700'} hover:bg-purple-700 transition-all duration-300 transform hover:scale-105`}
                        >
                            Coding Challenge
                        </Button>
                    </div>

                    {/* Conditional Rendering for MCQ Section */}
                    {assessmentType === 'mcq' && (
                        <>
                            {/* Dynamic MCQ Assessment Generation Input */}
                            {!currentQuestions.length && !currentAssessment ? (
                                <>
                                    <h3 className="text-2xl font-bold mb-6 text-gray-200 text-center">Generate a Custom MCQ Assessment</h3>
                                    <div className="mb-8 space-y-4">
                                        <Input
                                            id="assessmentTopic"
                                            label="Enter Assessment Topic (e.g., 'JavaScript Fundamentals', 'Project Management')"
                                            type="text"
                                            value={assessmentTopic}
                                            onChange={(e) => setAssessmentTopic(e.target.value)}
                                            placeholder="e.g., Python Basics, Data Structures"
                                            required
                                        />
                                        <Button
                                            onClick={generateAssessment}
                                            disabled={isGenerating || !assessmentTopic.trim()}
                                            icon={PlusCircle}
                                            className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 transform transition-transform duration-200 active:scale-95"
                                        >
                                            {isGenerating ? 'Generating Questions...' : 'Generate Assessment'}
                                        </Button>
                                        {isGenerating && <ProgressBar progress={0} animate indeterminate className="mt-4" />}
                                    </div>
                                    <hr className="my-8 border-gray-700" />
                                </>
                            ) : (
                                // Display Generated/Pre-defined MCQ Assessment
                                <>
                                    <h2 className="text-2xl font-bold mb-6 text-gray-200 text-center">
                                        {generatedQuestions.length > 0 ? `Assessment on: ${assessmentTopic}` : currentAssessment.title}
                                    </h2>
                                    {score !== null && (
                                        <div className="bg-blue-800 p-4 rounded-lg mb-6 text-center shadow-md">
                                            <p className="text-xl font-bold">Your Score: {score.toFixed(2)}%</p>
                                        </div>
                                    )}
                                    <form onSubmit={(e) => { e.preventDefault(); submitAssessment(); }} className="space-y-6">
                                        {currentQuestions.map((q, qIndex) => (
                                            <div key={qIndex} className="bg-gray-700 p-5 rounded-xl border border-gray-600 shadow-lg">
                                                <p className="font-semibold text-lg text-gray-200 mb-3">
                                                    {qIndex + 1}. {q.questionText}
                                                </p>
                                                {q.options && q.options.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {q.options.map((option, oIndex) => {
                                                            const optionLetter = getOptionLetter(oIndex);
                                                            const isUserAnswer = answers[qIndex] === optionLetter;
                                                            const isCorrectOption = score !== null && optionLetter === q.correctAnswer;
                                                            const isIncorrectUserSelection = score !== null && isUserAnswer && !isCorrectOption;

                                                            return (
                                                                <label
                                                                    key={oIndex}
                                                                    className={`flex items-center text-gray-300 cursor-pointer p-3 rounded-xl transition-colors duration-200 ease-in-out
                                                                        ${score !== null
                                                                            ? (isCorrectOption ? 'bg-green-700 text-white font-medium scale-100' : (isIncorrectUserSelection ? 'bg-red-700 text-white font-medium scale-100' : 'hover:bg-gray-600 opacity-70'))
                                                                            : (isUserAnswer ? 'bg-blue-600/30 text-blue-200 hover:bg-blue-600/50' : 'hover:bg-gray-600')
                                                                        }`}
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        name={`question-${qIndex}`}
                                                                        value={optionLetter}
                                                                        checked={answers[qIndex] === optionLetter}
                                                                        onChange={() => handleAnswerChange(qIndex, optionLetter)}
                                                                        className="mr-3 form-radio h-5 w-5 text-blue-500 transition-colors duration-200"
                                                                        disabled={score !== null} // Disable after submission
                                                                    />
                                                                    <span className="flex-grow">{optionLetter}. {option}</span>
                                                                    {score !== null && isCorrectOption && <span className="ml-auto text-white">✔️ Correct</span>}
                                                                    {score !== null && isIncorrectUserSelection && <span className="ml-auto text-white">❌ Incorrect</span>}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <Input
                                                        id={`answer-${qIndex}`}
                                                        type="text"
                                                        value={answers[qIndex] || ''}
                                                        onChange={(e) => handleAnswerChange(qIndex, e.target.value)}
                                                        placeholder="Your answer"
                                                        disabled={score !== null}
                                                    />
                                                )}
                                                {/* Explanation section, visible after submission and if explanation exists */}
                                                {score !== null && showExplanations && (
                                                    <div className={`mt-4 p-4 rounded-xl shadow-inner
                                                        ${q.isCorrect ? 'bg-green-800' : 'bg-red-800'}
                                                    `}>
                                                        <p className="font-bold text-white mb-2">
                                                            {q.isCorrect ? 'Correct Answer:' : `Correct Answer: ${q.correctAnswerValue}`}
                                                        </p>
                                                        <p className="text-sm text-white opacity-90">{q.explanation || 'No explanation provided.'}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {score === null && (
                                            <Button type="submit" disabled={isLoading || isGenerating} className="w-full bg-green-600 hover:bg-green-700 focus:ring-green-500 transform transition-transform duration-200 active:scale-95">
                                                {isLoading ? 'Submitting...' : 'Submit Assessment'}
                                            </Button>
                                        )}
                                        <Button onClick={() => { setGeneratedQuestions([]); setCurrentAssessment(null); setAssessmentTopic(''); setAnswers({}); setScore(null); setShowExplanations(false); setShowConfetti(false); }} className="w-full bg-gray-600 hover:bg-gray-700 mt-3 focus:ring-gray-500 transform transition-transform duration-200 active:scale-95">
                                            Take Another Assessment
                                        </Button>
                                    </form>
                                </>
                            )}

                            {/* Display pre-defined assessments if no dynamic one is being generated or taken */}
                            {!currentQuestions.length && !challengeProblem && !currentAssessment && (
                                <>
                                    <h2 className="text-2xl font-bold mb-6 text-gray-200 text-center">Available Pre-defined Assessments</h2>
                                    {assessments.length === 0 ? (
                                        <p className="text-gray-400 text-center">No pre-defined assessments available yet. You can generate one above!</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {assessments.map(assessment => (
                                                <div key={assessment.id} className="bg-gray-700 p-6 rounded-xl shadow-md flex flex-col justify-between border border-gray-600 hover:border-blue-500 transition-all duration-300">
                                                    <div>
                                                        <h3 className="text-xl font-semibold text-blue-300 mb-2">{assessment.title}</h3>
                                                        <p className="text-gray-300 mb-4 text-sm">{assessment.description || 'No description provided.'}</p>
                                                    </div>
                                                    <Button onClick={() => startAssessment(assessment.id)} className="w-full bg-green-600 hover:bg-green-700 mt-4 focus:ring-green-500 transform transition-transform duration-200 active:scale-95">
                                                        Start Assessment
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* Conditional Rendering for Coding Challenge Section */}
                    {assessmentType === 'coding' && (
                        <>
                            {/* Single Coding Challenge Generation */}
                            <h3 className="text-2xl font-bold mb-6 text-gray-200 text-center">Generate a Coding Challenge</h3>
                            <div className="mb-8 space-y-4">
                                <Input
                                    id="challengeTopic"
                                    label="Challenge Topic (Optional: Leave blank for AI to choose)"
                                    type="text"
                                    value={assessmentTopic}
                                    onChange={(e) => setAssessmentTopic(e.target.value)}
                                    placeholder="e.g., Array Manipulation, Sorting, Recursion"
                                />
                                <Input
                                    id="challengeLanguage"
                                    label="Programming Language"
                                    type="text"
                                    value={challengeLanguage}
                                    onChange={(e) => setChallengeLanguage(e.target.value)}
                                    placeholder="e.g., Python, JavaScript, Java, C++"
                                    required
                                />
                                <Select
                                    id="challengeDifficulty"
                                    label="Difficulty"
                                    value={challengeDifficulty}
                                    onChange={(e) => setChallengeDifficulty(e.target.value)}
                                    options={[
                                        { value: 'Easy', label: 'Easy' },
                                        { value: 'Medium', label: 'Medium' },
                                        { value: 'Hard', label: 'Hard' },
                                    ]}
                                    required
                                />
                                <Button
                                    onClick={generateCodingChallenge}
                                    disabled={isGenerating || !challengeLanguage.trim() || !challengeDifficulty.trim()}
                                    icon={PlusCircle}
                                    className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 transform transition-transform duration-200 active:scale-95"
                                >
                                    {isGenerating ? 'Generating Challenge...' : 'Generate Coding Challenge'}
                                </Button>
                                {isGenerating && <ProgressBar progress={0} animate indeterminate className="mt-4" />}
                            </div>

                            <hr className="my-8 border-gray-700" />

                            {/* Multiple Coding Challenges Generation */}
                            <h3 className="text-2xl font-bold mb-6 text-gray-200 text-center">Generate Multiple Challenges</h3>
                            <div className="mb-8 space-y-4">
                                <p className="text-gray-300 text-center">Generate challenges for specific difficulties (ensure language is set above):</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label htmlFor="easyCount" className="block text-gray-300 text-sm font-medium mb-2">Easy Challenges</label>
                                        <input type="number" id="easyCount" min="0" defaultValue="3" className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                                    </div>
                                    <div>
                                        <label htmlFor="mediumCount" className="block text-gray-300 text-sm font-medium mb-2">Medium Challenges</label>
                                        <input type="number" id="mediumCount" min="0" defaultValue="2" className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                                    </div>
                                    <div>
                                        <label htmlFor="hardCount" className="block text-gray-300 text-sm font-medium mb-2">Hard Challenges</label>
                                        <input type="number" id="hardCount" min="0" defaultValue="1" className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                                    </div>
                                </div>
                                <Button
                                    onClick={() => {
                                        const easyCount = parseInt(document.getElementById('easyCount').value) || 0;
                                        const mediumCount = parseInt(document.getElementById('mediumCount').value) || 0;
                                        const hardCount = parseInt(document.getElementById('hardCount').value) || 0;
                                        generateMultipleChallenges({ Easy: easyCount, Medium: mediumCount, Hard: hardCount });
                                    }}
                                    disabled={isGeneratingMultiple || !challengeLanguage.trim()}
                                    icon={PlusCircle}
                                    className="w-full bg-teal-600 hover:bg-teal-700 focus:ring-teal-500 transform transition-transform duration-200 active:scale-95"
                                >
                                    {isGeneratingMultiple ? 'Generating Multiple Challenges...' : 'Generate Multiple Challenges'}
                                </Button>
                                {isGeneratingMultiple && <ProgressBar progress={0} animate indeterminate className="mt-4" />}
                            </div>

                            {/* Display Generated Multiple Challenges */}
                            {generatedChallenges.length > 0 && (
                                <div className="mt-8 space-y-6">
                                    <h4 className="text-xl font-semibold text-white mb-4 text-center">Generated Challenge Set:</h4>
                                    {generatedChallenges.map((challenge, index) => (
                                        <div key={index} className="bg-gray-700 p-6 rounded-xl shadow-inner border border-gray-600 hover:border-indigo-500 transition-all duration-300">
                                            <h5 className="text-lg font-bold text-blue-300 mb-2">{challenge.title} ({challenge.difficulty})</h5>
                                            <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">{challenge.problemStatement}</p>
                                            <h6 className="text-md font-semibold mt-4 text-gray-200">Test Cases:</h6>
                                            <div className="space-y-2 mt-2">
                                                {challenge.testCases.map((tc, tcIndex) => (
                                                    <div key={tcIndex} className="mb-1 p-2 bg-gray-800 rounded-md text-sm border border-gray-700">
                                                        <p className="font-mono text-gray-300"><strong>Input:</strong> <span className="text-blue-200">{tc.input}</span></p>
                                                        <p className="font-mono text-gray-300"><strong>Expected Output:</strong> <span className="text-green-200">{tc.expectedOutput}</span></p>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Option to attempt this specific challenge */}
                                            <Button
                                                onClick={() => {
                                                    setChallengeProblem(challenge); // Load this challenge into the editor
                                                    setUserCode(''); // Clear previous user code
                                                    setCodeEvaluationResult(null); // Clear previous evaluation results
                                                    setMessage('Challenge loaded. Write your code below!');
                                                    setMessageType('info');
                                                    setShowMessageBox(true);
                                                    setGeneratedChallenges([]); // Clear the list of multiple challenges once one is selected
                                                }}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 mt-6 text-sm focus:ring-indigo-500 transform transition-transform duration-200 active:scale-95"
                                            >
                                                Attempt This Challenge
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Display Single Coding Challenge Problem and Code Editor */}
                            {challengeProblem && (
                                <div className="mt-8 bg-gray-700 p-6 rounded-xl shadow-inner border border-gray-600">
                                    <h4 className="text-xl font-semibold text-white mb-4 text-center">{challengeProblem.title}</h4>
                                    <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed mb-6">
                                        <p className="whitespace-pre-wrap">{challengeProblem.problemStatement}</p>
                                        <h5 className="text-lg font-semibold mt-6 mb-3 text-gray-200">Test Cases:</h5>
                                        {challengeProblem.testCases.map((tc, index) => (
                                            <div key={index} className="mb-3 p-3 bg-gray-800 rounded-md border border-gray-700">
                                                <p className="font-mono text-gray-300"><strong>Input:</strong> <span className="text-blue-200">{tc.input}</span></p>
                                                <p className="font-mono text-gray-300"><strong>Expected Output:</strong> <span className="text-green-200">{tc.expectedOutput}</span></p>
                                            </div>
                                        ))}
                                    </div>

                                    <h5 className="text-lg font-semibold text-white mt-6 mb-3">Your Code ({challengeProblem.language}):</h5>
                                    <Textarea
                                        id="userCode"
                                        value={userCode}
                                        onChange={(e) => setUserCode(e.target.value)}
                                        placeholder={`Write your ${challengeProblem.language} code here...`}
                                        rows="10"
                                        className="font-mono text-base bg-gray-800 border-gray-600 focus:border-blue-500 focus:ring-blue-500"
                                    />
                                    <Button
                                        onClick={submitCodingChallenge}
                                        disabled={isEvaluatingCode || !userCode.trim()}
                                        icon={Send}
                                        className="w-full bg-green-600 hover:bg-green-700 mt-4 focus:ring-green-500 transform transition-transform duration-200 active:scale-95"
                                    >
                                        {isEvaluatingCode ? 'Evaluating Code...' : 'Submit Code'}
                                    </Button>
                                    {isEvaluatingCode && <ProgressBar progress={0} animate indeterminate className="mt-4" />}

                                    {/* Display Code Evaluation Results */}
                                    {codeEvaluationResult && (
                                        <div className="mt-6 bg-gray-600 p-6 rounded-xl shadow-inner border border-gray-500">
                                            <h4 className="text-xl font-semibold text-white mb-3 text-center">Evaluation Results:</h4>
                                            <p className="text-lg mb-2 text-gray-200">
                                                Overall Feedback: <span className="font-bold text-blue-300">{codeEvaluationResult.overallFeedback}</span>
                                            </p>
                                            <p className="text-lg mb-4 text-gray-200">
                                                Score: <span className="font-bold text-green-300">{codeEvaluationResult.score}%</span>
                                            </p>
                                            <h5 className="text-md font-semibold text-gray-200 mb-2">Test Case Results:</h5>
                                            <ul className="list-disc list-inside text-gray-300 space-y-1">
                                                {codeEvaluationResult.testCaseResults.map((result, index) => (
                                                    <li key={index} className={result.passed ? 'text-green-300' : 'text-red-300'}>
                                                        Input: `{result.input}` | Expected: `{result.expected}` | Actual (Predicted): `{result.actual}` | Status: <span className="font-semibold">{result.passed ? 'Passed' : 'Failed'}</span>
                                                        {result.feedback && <span className="ml-2 text-sm italic opacity-90">({result.feedback})</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                            <h5 className="text-md font-semibold text-gray-200 mt-4 mb-2">Identified Error:</h5>
                                            <p className="whitespace-pre-wrap text-red-300 bg-gray-700 p-3 rounded-md border border-red-700">{codeEvaluationResult.identifiedError || 'N/A'}</p>
                                            <h5 className="text-md font-semibold text-gray-200 mt-4 mb-2">Correction Needed:</h5>
                                            <p className="whitespace-pre-wrap text-green-300 bg-gray-700 p-3 rounded-md border border-green-700">{codeEvaluationResult.correctionNeeded || 'N/A'}</p>
                                            <h5 className="text-md font-semibold text-gray-200 mt-4 mb-2">Suggestions for Improvement:</h5>
                                            <p className="whitespace-pre-wrap text-gray-300 bg-gray-700 p-3 rounded-md border border-gray-700">{codeEvaluationResult.suggestionsForImprovement}</p>
                                            <Button
                                                onClick={() => { setChallengeProblem(null); setUserCode(''); setCodeEvaluationResult(null); setAssessmentTopic(''); setShowConfetti(false); }}
                                                className="w-full bg-gray-600 hover:bg-gray-700 mt-6 focus:ring-gray-500 transform transition-transform duration-200 active:scale-95"
                                            >
                                                Generate New Challenge
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Message Box Component */}
            {showMessageBox && (
                <MessageBox message={message} type={messageType} onConfirm={() => setShowMessageBox(false)} />
            )}
        </div>
    );
};



                // --- Learning Platform Page ---
               const LearningPlatform = ({ setCurrentPage }) => {
    const { userId, db, isAuthReady, geminiApiKey, appId } = useFirebase();
    const [modules, setModules] = useState([]); // Admin-created modules
    const [aiSuggestedCourses, setAiSuggestedCourses] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentCourseContent, setCurrentCourseContent] = useState(null);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [isFetchingCourseContent, setIsFetchingCourseContent] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [showMessageBox, setShowMessageBox] = useState(false);
    const [isLoadingModules, setIsLoadingModules] = useState(true);

    const synth = useRef(window.speechSynthesis);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingUtterance, setSpeakingUtterance] = useState(null);

    const speakText = (text) => {
        if (!synth.current) {
            setMessage('Text-to-Speech not supported in your browser.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }

        if (synth.current.speaking) {
            synth.current.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
            setMessage(`Text-to-Speech error: ${event.error}`);
            setMessageType('error');
            setShowMessageBox(true);
            setIsSpeaking(false);
        };
        synth.current.speak(utterance);
        setIsSpeaking(true);
        setSpeakingUtterance(utterance);
    };

    const stopSpeaking = () => {
        if (synth.current && synth.current.speaking) {
            synth.current.cancel();
            setIsSpeaking(false);
            setSpeakingUtterance(null);
        }
    };

    useEffect(() => {
        if (isAuthReady && !userId) {
            setCurrentPage('auth');
            return;
        }
        if (isAuthReady && db) {
            const contentColRef = collection(db, `artifacts/${appId}/content`);
            const q = query(contentColRef, where("type", "==", "module"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoadingModules(false);
            }, (error) => {
                console.error("Error fetching learning modules:", error);
                setMessage('Failed to load learning modules.');
                setMessageType('error');
                setShowMessageBox(true);
                setIsLoadingModules(false);
            });
            return () => unsubscribe();
        }
    }, [isAuthReady, userId, db, setCurrentPage, appId]);

    const getSuggestedCourses = async (topic) => {
        if (!geminiApiKey) {
            setMessage('Gemini API key is not configured.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }
        if (!topic.trim()) {
            setMessage('Please enter a topic for course suggestions.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }

        setIsGeneratingSuggestions(true);
        setAiSuggestedCourses([]);
        setCurrentCourseContent(null);
        setSummary('');
        stopSpeaking();
        setMessage(`Getting course suggestions for "${topic}"...`);
        setMessageType('info');
        setShowMessageBox(true);

        const prompt = `Suggest 5 unique learning course titles and brief descriptions (1-2 sentences) on the topic "${topic}". Respond in a JSON array of objects, each with "title" and "description" fields.`;

        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "title": { "type": "STRING" },
                            "description": { "type": "STRING" }
                        },
                        "propertyOrdering": ["title", "description"]
                    }
                }
            },
        };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 2000;

        while (retries < maxRetries) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 429) {
                    const delay = baseDelay * Math.pow(2, retries);
                    console.warn(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                    await new Promise(res => setTimeout(res, delay));
                    retries++;
                    continue;
                }

                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody.error?.message || 'Unknown error'}`);
                }

                const result = await response.json();
                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const jsonString = result.candidates[0].content.parts[0].text;
                    const parsedSuggestions = JSON.parse(jsonString);
                    setAiSuggestedCourses(parsedSuggestions);
                    setMessage('Course suggestions generated!');
                    setMessageType('success');
                } else {
                    setMessage('Failed to get course suggestions from Gemini.');
                    setMessageType('error');
                }
                break;
            } catch (error) {
                console.error("Error fetching AI suggestions:", error);
                setMessage(`Failed to get suggestions: ${error.message}.`);
                setMessageType('error');
                break;
            } finally {
                setIsGeneratingSuggestions(false);
                setShowMessageBox(true);
            }
        }
        if (retries === maxRetries) {
            setMessage('Failed to get course suggestions after multiple retries.');
            setMessageType('error');
            setShowMessageBox(true);
            setIsGeneratingSuggestions(false);
        }
    };

    // Modified getCourseContent to handle contentUrl, moduleContent, and AI generation
    const getCourseContent = async (courseTitle, isAiGenerated = true, contentUrl = null, description = null, moduleContent = null) => {
        stopSpeaking();
        setSummary('');
        setCurrentCourseContent(null);
        setIsFetchingCourseContent(true);

        // Priority 1: External URL
        if (!isAiGenerated && contentUrl) {
            setCurrentCourseContent({
                title: courseTitle,
                content: `Please visit the external link to access the course material: \n\n <a href="${contentUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${contentUrl}</a>`
            });
            setMessage('Displaying external course link.');
            setMessageType('info');
            setShowMessageBox(true);
            summarizeContent(`Course: ${courseTitle}. Content available at: ${contentUrl}`);
            setIsFetchingCourseContent(false);
            return;
        }

        // Priority 2: Manual Module Content (if no URL and content is present)
        if (!isAiGenerated && moduleContent && moduleContent.trim() !== '') {
            setCurrentCourseContent({
                title: courseTitle,
                content: moduleContent
            });
            setMessage('Displaying module content.');
            setMessageType('info');
            setShowMessageBox(true);
            summarizeContent(moduleContent); // Summarize the manual content
            setIsFetchingCourseContent(false);
            return;
        }

        // Priority 3: AI-Generated Content (if neither URL nor manual content is present)
        if (!geminiApiKey) {
            setMessage('Gemini API key is not configured.');
            setMessageType('error');
            setShowMessageBox(true);
            setIsFetchingCourseContent(false);
            return;
        }

        setMessage(`Generating content for "${courseTitle}"...`);
        setMessageType('info');
        setShowMessageBox(true);

        const prompt = `Provide detailed learning content for a course titled "${courseTitle}". Structure the content with clear headings, subheadings, and bullet points. Make it comprehensive, engaging, and suitable for self-study. Aim for a response length of 500-800 words.`;

        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.7,
            },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 2000;

        while (retries < maxRetries) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 429) {
                    const delay = baseDelay * Math.pow(2, retries);
                    console.warn(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                    await new Promise(res => setTimeout(res, delay));
                    retries++;
                    continue;
                }

                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody.error?.message || 'Unknown error'}`);
                }

                const result = await response.json();
                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const content = result.candidates[0].content.parts[0].text;
                    setCurrentCourseContent({ title: courseTitle, content: content });
                    setMessage('Course content generated!');
                    setMessageType('success');
                    summarizeContent(content);
                } else {
                    setMessage('Failed to generate course content from Gemini.');
                    setMessageType('error');
                }
                break;
            } catch (error) {
                console.error("Error fetching AI course content:", error);
                setMessage(`Failed to get course content: ${error.message}.`);
                setMessageType('error');
                break;
            } finally {
                setIsFetchingCourseContent(false);
                setShowMessageBox(true);
            }
        }
        if (retries === maxRetries) {
            setMessage('Failed to get course content after multiple retries.');
            setMessageType('error');
            setShowMessageBox(true);
            setIsFetchingCourseContent(false);
        }
    };

    const summarizeContent = async (text) => {
        if (!geminiApiKey || !text.trim()) {
            setSummary('Cannot summarize: no text or API key.');
            return;
        }

        setIsSummarizing(true);
        setSummary('');
        setMessage('Summarizing content...');
        setMessageType('info');
        setShowMessageBox(true);

        const prompt = `Summarize the following learning content concisely (2-3 sentences): \n\n ${text}`;

        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.5,
            },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const generatedSummary = result.candidates[0].content.parts[0].text;
                setSummary(generatedSummary);
                setMessage('Content summarized!');
                setMessageType('success');
            } else {
                setSummary('Could not generate a summary.');
                setMessage('Failed to generate summary.');
                setMessageType('error');
            }
        } catch (error) {
            console.error("Error summarizing content:", error);
            setSummary(`Error summarizing: ${error.message}`);
            setMessage(`Failed to summarize: ${error.message}.`);
            setMessageType('error');
        } finally {
            setIsSummarizing(false);
            setShowMessageBox(true);
        }
    };

    const markModuleComplete = async (moduleId) => {
        if (!userId || !db) return;

        setIsLoadingModules(true);
        setShowMessageBox(false);

        try {
            const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
            const profileSnap = await getDoc(userProfileRef);
            if (profileSnap.exists()) {
                const profileData = profileSnap.data();
                const currentCompletedModules = profileData.completedModules || [];
                const currentPoints = profileData.points || 0;
                const currentWorkflowProgress = profileData.workflowProgress || 0;

                if (!currentCompletedModules.includes(moduleId)) {
                    await updateDoc(userProfileRef, {
                        completedModules: [...currentCompletedModules, moduleId],
                        points: currentPoints + 50,
                        workflowProgress: Math.min(100, currentWorkflowProgress + 10),
                    });
                    setMessage('Module marked as complete! Points and progress updated.');
                    setMessageType('success');
                } else {
                    setMessage('This module is already marked as complete.');
                    setMessageType('info');
                }
            } else {
                setMessage('User profile not found.');
                setMessageType('error');
            }
            setShowMessageBox(true);
        } catch (error) {
            console.error("Error marking module complete:", error);
            setMessage(`Failed to mark module complete: ${error.message}`);
            setMessageType('error');
            setShowMessageBox(true);
        } finally {
            setIsLoadingModules(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setMessage('Please enter a search term.');
            setMessageType('error');
            setShowMessageBox(true);
            return;
        }

        const foundModule = modules.find(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
        if (foundModule) {
            // Pass contentUrl, description, and moduleContent
            getCourseContent(foundModule.title, false, foundModule.contentUrl, foundModule.description, foundModule.moduleContent);
            return;
        }

        getSuggestedCourses(searchQuery);
    };


    if (isLoadingModules) {
        return <LoadingPage message="Loading learning platform..." />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
            <header className="flex justify-between items-center p-6 bg-gray-900 shadow-lg">
                <h1 className="text-3xl font-extrabold text-blue-400">Learning Platform</h1>
                <Button onClick={() => setCurrentPage('dashboard')} icon={Home} className="bg-gray-700 hover:bg-gray-600">
                    Back to Dashboard
                </Button>
            </header>

            <main className="flex-grow p-6 flex flex-col md:flex-row gap-6">
                <div className="bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700 w-full md:w-1/3 flex-shrink-0">
                    <h2 className="text-2xl font-bold mb-6 text-gray-200 flex items-center gap-2">
                        <Search size={24} /> Discover Courses
                    </h2>
                    <form onSubmit={handleSearch} className="mb-6 flex gap-2">
                        <Input
                            id="courseSearch"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search or suggest a topic..."
                            className="flex-grow"
                        />
                        <Button type="submit" disabled={isGeneratingSuggestions || isFetchingCourseContent} icon={Search} className="bg-purple-600 hover:bg-purple-700">
                            Search / Suggest
                        </Button>
                    </form>
                    {isGeneratingSuggestions && <ProgressBar progress={0} animate indeterminate className="mb-4" />}
                    {aiSuggestedCourses.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold text-blue-300 mb-4">AI Suggested Courses</h3>
                            <div className="space-y-4">
                                {aiSuggestedCourses.map((course, index) => (
                                    <div key={`ai-${index}`} className="bg-gray-700 p-4 rounded-lg shadow-sm">
                                        <h4 className="font-semibold text-lg text-gray-100">{course.title}</h4>
                                        <p className="text-gray-300 text-sm mb-3">{course.description}</p>
                                        <Button
                                            onClick={() => getCourseContent(course.title, true)}
                                            disabled={isFetchingCourseContent || isGeneratingSuggestions}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-xs"
                                        >
                                            View Content
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <h3 className="text-xl font-semibold text-yellow-300 mb-4">Admin Created Modules</h3>
                    {modules.length === 0 ? (
                        <p className="text-gray-400">No admin modules available yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {modules.map(module => (
                                <div key={module.id} className="bg-gray-700 p-4 rounded-lg shadow-sm">
                                    <h4 className="font-semibold text-lg text-gray-100">{module.title}</h4>
                                    <p className="text-gray-300 text-sm mb-3">Category: {module.category}</p>
                                    <Button
                                        onClick={() => getCourseContent(module.title, false, module.contentUrl, module.description, module.moduleContent)}
                                        disabled={isFetchingCourseContent || isGeneratingSuggestions}
                                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-xs"
                                    >
                                        View Content
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700 w-full md:w-2/3">
                    <h2 className="text-2xl font-bold mb-6 text-gray-200 flex items-center gap-2">
                        <BookOpen size={24} /> Course Content
                    </h2>
                    {isFetchingCourseContent && <ProgressBar progress={0} animate indeterminate className="mb-4" />}
                    {!currentCourseContent ? (
                        <div className="text-center text-gray-400 p-10">
                            <p>Select a course from the left to view its content here.</p>
                            <p className="mt-2">Or use the search/suggest bar to find new courses!</p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-xl font-bold text-green-300 mb-4">{currentCourseContent.title}</h3>
                            <div className="bg-gray-700 p-4 rounded-lg mb-4">
                                <h4 className="font-semibold text-lg text-gray-100 mb-2">Summary:</h4>
                                {isSummarizing ? (
                                    <p className="text-gray-400">Generating summary...</p>
                                ) : (
                                    <p className="text-gray-300">{summary || 'No summary available.'}</p>
                                )}
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        onClick={() => speakText(currentCourseContent.content)}
                                        disabled={isSpeaking || !currentCourseContent.content}
                                        icon={Play}
                                        className="bg-blue-600 hover:bg-blue-700 text-sm"
                                    >
                                        Play Content
                                    </Button>
                                    <Button
                                        onClick={stopSpeaking}
                                        disabled={!isSpeaking}
                                        icon={CircleStop}
                                        className="bg-red-600 hover:bg-red-700 text-sm"
                                    >
                                        Stop
                                    </Button>
                                    <Button
                                        onClick={() => speakText(summary)}
                                        disabled={isSpeaking || !summary}
                                        icon={Play}
                                        className="bg-purple-600 hover:bg-purple-700 text-sm"
                                    >
                                        Play Summary
                                    </Button>
                                </div>
                            </div>
                            <div className="bg-gray-700 p-5 rounded-lg max-h-[calc(100vh-350px)] overflow-y-auto custom-scrollbar">
                                {/* Using dangerouslySetInnerHTML if content contains HTML (like the <a> tag for URL) */}
                                <pre className="whitespace-pre-wrap font-sans text-gray-200" dangerouslySetInnerHTML={{ __html: currentCourseContent.content }}>
                                </pre>
                            </div>
                            {currentCourseContent && !currentCourseContent.content.startsWith("Please visit the external link") && (
                                <Button
                                    onClick={() => markModuleComplete(currentCourseContent.title)}
                                    className="w-full bg-green-600 hover:bg-green-700 mt-6"
                                >
                                    Mark as Complete (AI Generated)
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </main>
            {showMessageBox && (
                <MessageBox message={message} type={messageType} onConfirm={() => setShowMessageBox(false)} />
            )}
        </div>
    );
};

                // --- Leaderboard Page ---
                const Leaderboard = ({ setCurrentPage }) => {
    const { db, isAuthReady, appId } = useFirebase();
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [showMessageBox, setShowMessageBox] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isAuthReady && db) {
            // Refactored to read from the main user document
            const usersCollectionRef = collection(db, `artifacts/${appId}/users`);

            const unsubscribe = onSnapshot(usersCollectionRef, async (snapshot) => {
                const usersList = [];
                for (const docSnap of snapshot.docs) {
                    const userData = docSnap.data();
                    const profileDocRef = doc(db, `artifacts/${appId}/users/${docSnap.id}/profile/data`);
                    const profileSnap = await getDoc(profileDocRef);

                    let userProfileData = {};
                    if (profileSnap.exists()) {
                        userProfileData = profileSnap.data();
                    }

                    usersList.push({
                        id: docSnap.id,
                        email: userProfileData.email || 'N/A', // Get email from userProfileData
                        userType: userData.userType,
                        // Correctly get points and workflowProgress from the profile data,
                        // with a fallback to 0 if the field doesn't exist
                        points: userProfileData.points || 0,
                        workflowProgress: userProfileData.workflowProgress || 0,
                    });
                }
                
                // Sort by points in descending order
                usersList.sort((a, b) => b.points - a.points);
                setLeaderboardData(usersList);
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching leaderboard data:", error);
                setMessage('Failed to load leaderboard data.');
                setMessageType('error');
                setShowMessageBox(true);
                setIsLoading(false);
            });

            return () => unsubscribe();
        }
    }, [isAuthReady, db, setCurrentPage, appId]);

    if (isLoading) {
        return <LoadingPage message="Loading leaderboard..." />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
            <header className="flex justify-between items-center p-6 bg-gray-900 shadow-lg">
                <h1 className="text-3xl font-extrabold text-blue-400">Leaderboard</h1>
                <Button onClick={() => setCurrentPage('dashboard')} icon={Home} className="bg-gray-700 hover:bg-gray-600">
                    Back to Dashboard
                </Button>
            </header>

            <main className="flex-grow p-6 flex justify-center items-start">
                <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700 w-full max-w-3xl">
                    <h2 className="text-2xl font-bold mb-6 text-gray-200 flex items-center gap-2"><Award size={24} /> Top Performers</h2>
                    {showMessageBox && (
                        <div className="mb-4">
                            <MessageBox message={message} type={messageType} onConfirm={() => setShowMessageBox(false)} />
                        </div>
                    )}
                    {leaderboardData.length === 0 ? (
                        <p className="text-gray-400">No users on the leaderboard yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                                <thead className="bg-gray-600">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Rank</th>
                                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">User Email</th>
                                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Points</th>
                                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Progress</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboardData.map((user, index) => (
                                        <tr key={user.id} className="border-t border-gray-600 hover:bg-gray-600">
                                            <td className="py-3 px-4 text-gray-300 font-bold">#{index + 1}</td>
                                            <td className="py-3 px-4 text-gray-300">{user.email}</td>
                                            <td className="py-3 px-4 text-gray-300">{user.points}</td>
                                            <td className="py-3 px-4 text-gray-300">{user.workflowProgress}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

                // --- Main App Component (Modified to include new chatbot page) ---
                // Manages overall application state and page routing.
                const App = () => {
                    const { userId, userRole, isAuthReady, auth, db, appId } = useFirebase(); // Get appId from useFirebase
                    const [currentPage, setCurrentPage] = useState('loading'); // Initial state 'loading'

                    // --- RECTIFIED LOGIC ---
                    // This effect is now the single source of truth for routing after authentication.
                    // It relies on the `userRole` from the `useFirebase` hook, removing the redundant
                    // and problematic profile fetch that was causing the race condition.
                    useEffect(() => {
                        console.log("App Component useEffect: userId:", userId, "userRole:", userRole, "isAuthReady:", isAuthReady);

                        if (isAuthReady) {
                            if (!userId) {
                                // If auth is ready and there's no user, go to the login page.
                                setCurrentPage('auth');
                            } else if (userRole) {
                                // If we have a user and their role is determined, route them.
                                if (userRole === 'admin') {
                                    setCurrentPage('adminDashboard');
                                } else if (userRole === 'employee') {
                                    setCurrentPage('dashboard');
                                } else {
                                    // Fallback for any other role, though shouldn't happen with current logic.
                                    setCurrentPage('auth');
                                }
                            } else {
                                // This case handles a logged-in user whose profile (and thus role)
                                // might not have been fetched yet, or a new user.
                                // We will check if their profile exists. If not, they need to set it up.
                                const checkProfileExists = async () => {
                                    if (!db || !auth) return; // Ensure db and auth are ready
                                    const userProfileDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`); // Corrected path
                                    const docSnap = await getDoc(userProfileDocRef);
                                    if (!docSnap.exists()) {
                                        setCurrentPage('profileSetup');
                                    }
                                    // If the profile *does* exist, the `userRole` state will update shortly,
                                    // and this useEffect will run again to route them correctly.
                                };
                                checkProfileExists();
                            }
                        }
                        // If auth is not ready, we do nothing and the 'loading' page remains.
                    }, [userId, userRole, isAuthReady, auth, db, appId]); // Add appId to dependency array
                    // --- END RECTIFIED LOGIC ---

                    const handleAuthSuccessAndMessageDismissed = () => {
                        // This function is called from the Auth component after a successful registration message is dismissed.
                        // It's specifically for newly registered users to proceed to profile setup.
                        setCurrentPage('profileSetup');
                    };

                    // Render the current page based on state
                   // ... (inside App component)

const renderPage = () => {
    switch (currentPage) {
        case 'loading':
            return <LoadingPage message="Initializing application..." />;
        case 'auth': // This case will now render your new LoginPage
            return <LoginPage setCurrentPage={setCurrentPage} onAuthSuccessAndMessageDismissed={handleAuthSuccessAndMessageDismissed} />;
        case 'profileSetup':
            return <ProfileSetup setCurrentPage={setCurrentPage} />;
        case 'dashboard':
            return <Dashboard setCurrentPage={setCurrentPage} />;
        case 'adminDashboard':
            return <AdminDashboard setCurrentPage={setCurrentPage} />;
        case 'assessment':
            return <Assessment setCurrentPage={setCurrentPage} />;
        case 'learningPlatform':
            return <LearningPlatform setCurrentPage={setCurrentPage} />;
        case 'leaderboard':
            return <Leaderboard setCurrentPage={setCurrentPage} />;
        case 'maverickChatbot':
            return <MaverickChatbot setCurrentPage={setCurrentPage} />;
        default:
            // Fallback to LoginPage if currentPage is not recognized
            return <LoginPage setCurrentPage={setCurrentPage} onAuthSuccessAndMessageDismissed={handleAuthSuccessAndMessageDismissed} />;
    }
};
return (
        <div className="app-container">
            {renderPage()}
        </div>
    );
};

// --- EXPORT STATEMENT MUST BE AT THE VERY END OF THE FILE ---
export default App;
