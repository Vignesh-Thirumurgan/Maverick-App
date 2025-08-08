// src/components/UserDetailsModal.jsx

import React, { useEffect, useState } from 'react';
import { Modal, LoadingPage } from './common/UIComponents.jsx'; // Assuming Modal and LoadingPage are here
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from 'recharts';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    // Legend // Removed duplicate import of Legend from 'chart.js'
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    // Legend // Removed duplicate registration of Legend
);

// Import useFirebase hook to potentially fetch ideal skills if needed
import { useFirebase } from '../hooks/useFirebaseHook.jsx';

// EmployeeProfileDetails component
const EmployeeProfileDetails = ({ employee, recommendedRoleName }) => {
    const { geminiApiKey } = useFirebase(); // Access geminiApiKey
    const [targetRoleSkills, setTargetRoleSkills] = useState([]);
    const [isFetchingTargetSkills, setIsFetchingTargetSkills] = useState(false);
    const profileSkills = employee?.skills || [];

    // Effect to fetch ideal skills for the recommended role if a roleName is provided
    useEffect(() => {
        const fetchIdealSkillsForRole = async () => {
            if (!recommendedRoleName || !geminiApiKey) {
                setTargetRoleSkills([]);
                return;
            }

            setIsFetchingTargetSkills(true);
            // Prompt Gemini to infer skills for the recommended role
            const prompt = `For the job role "${recommendedRoleName}", identify the 5-7 most crucial skills and their typical proficiency levels. Assign a numerical proficiency score from 0 (Novice) to 5 (Expert) for each skill. Provide the response as a JSON array of objects, where each object has "name" (string) and "level" (integer from 0-5).`;

            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = {
                contents: chatHistory,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "name": { "type": "STRING" }, // Changed from skillName to name to match user's skill structure
                                "level": { "type": "NUMBER" } // Changed from proficiency to level
                            },
                            "propertyOrdering": ["name", "level"]
                        }
                    }
                }
            };

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

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
                    const jsonString = result.candidates[0].content.parts[0].text;
                    const parsedSkills = JSON.parse(jsonString);
                    setTargetRoleSkills(parsedSkills);
                } else {
                    console.warn("Gemini returned no valid skills for target role:", recommendedRoleName);
                    setTargetRoleSkills([]);
                }
            } catch (error) {
                console.error("Error fetching ideal role skills for radar chart:", error);
                setTargetRoleSkills([]);
            } finally {
                setIsFetchingTargetSkills(false);
            }
        };

        fetchIdealSkillsForRole();
    }, [recommendedRoleName, geminiApiKey]); // Re-run when role name or API key changes

    // Prepare data for Radar Chart
    const getRadarChartData = () => {
        const data = [];
        const allSkills = new Set();

        profileSkills.forEach(s => allSkills.add(s.name.toLowerCase()));
        targetRoleSkills.forEach(s => allSkills.add(s.name.toLowerCase()));

        allSkills.forEach(skillName => {
            const userSkill = profileSkills.find(s => s.name.toLowerCase() === skillName);
            const targetSkill = targetRoleSkills.find(s => s.name.toLowerCase() === skillName);

            data.push({
                subject: skillName.charAt(0).toUpperCase() + skillName.slice(1), // Capitalize first letter
                'Your Proficiency': userSkill ? userSkill.level : 0,
                'Target Proficiency': targetSkill ? targetSkill.level : 0,
                fullMark: 5, // Max level for skills
            });
        });
        return data;
    };

    // Radar chart options (can be defined outside if not dynamic)
    const radarChartOptions = {
        scales: {
            r: {
                angleLines: { color: '#4b5563' }, // gray-600
                grid: { color: '#4b5563' },
                pointLabels: { color: '#e5e7eb' }, // gray-200
                suggestedMin: 0,
                suggestedMax: 5,
                ticks: { backdropColor: '#1f2937' }, // gray-800
            },
        },
        plugins: {
            legend: { labels: { color: '#e5e7eb' } },
        },
        elements: {
            line: {
                borderWidth: 3,
            },
            point: {
                radius: 4,
                hoverRadius: 6,
            },
        },
    };

    if (isFetchingTargetSkills) {
        return <LoadingPage message={`Inferring skills for ${recommendedRoleName}...`} />;
    }

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-2">{employee?.fullName || employee?.email || 'Employee Details'}</h2>
            <p className="text-gray-400 mb-4">Email: {employee?.email}</p>
            <p className="text-gray-400 mb-4">User ID: {employee?.userId || 'N/A'}</p> {/* Displaying the userId */}
            <p className="text-gray-400 mb-4">User Type: {employee?.userType || 'N/A'}</p>
            <p className="text-gray-400 mb-4">Target Role (Self-Declared): {employee?.targetRole || 'Not Set'}</p>

            {/* Display Matching Skills (from AI recommendation if available) */}
            {employee?.matchingSkills && employee.matchingSkills.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2">AI-Identified Matching Skills for "{recommendedRoleName}":</h3>
                    <ul className="list-disc list-inside text-gray-300">
                        {employee.matchingSkills.map((skill, index) => (
                            <li key={index}>{skill.name} (Level: {skill.level})</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Display All Self-Assessed Skills */}
            {profileSkills.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2">All Self-Assessed Skills:</h3>
                    <ul className="list-disc list-inside text-gray-300">
                        {profileSkills.map((skill, index) => (
                            <li key={index}>{skill.name} (Level: {skill.level})</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Radar Chart for Skill Comparison */}
            {(profileSkills.length > 0 || targetRoleSkills.length > 0) ? (
                <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2">Skill Proficiency Comparison</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart outerRadius={90} data={getRadarChartData()}>
                            <PolarGrid stroke="#4a5568" />
                            <PolarAngleAxis dataKey="subject" stroke="#cbd5e0" />
                            <PolarRadiusAxis angle={90} domain={[0, 5]} stroke="#cbd5e0" />
                            <Radar name="Employee Proficiency" dataKey="Your Proficiency" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                            {targetRoleSkills.length > 0 && (
                                <Radar name={`Target Role (${recommendedRoleName})`} dataKey="Target Proficiency" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                            )}
                            <Legend wrapperStyle={{ color: '#ffffff' }} id="skill-comparison-legend" /> {/* Added unique ID */}
                        </RadarChart>
                    </ResponsiveContainer>
                    {recommendedRoleName && (
                        <p className="text-gray-400 text-sm mt-2 text-center">
                            *Target proficiency for "{recommendedRoleName}" is inferred by AI based on the role description.
                        </p>
                    )}
                </div>
            ) : (
                <p className="text-gray-400 text-center">No skill data available for comparison.</p>
            )}
        </div>
    );
};


// UserDetailsModal component
const UserDetailsModal = ({ user, onClose, recommendedRoleName }) => {
    // This component now acts as a wrapper for EmployeeProfileDetails
    // It receives the 'user' object (which is actually the profile data or enriched recommendation)
    // and passes relevant parts to EmployeeProfileDetails.
    return (
        <Modal onClose={onClose} title={user?.fullName ? `${user.fullName}'s Profile` : 'User Profile'}>
            <EmployeeProfileDetails
                employee={user} // Pass the user object directly
                recommendedRoleName={recommendedRoleName} // Pass the searched role name for AI inference
            />
        </Modal>
    );
};

export default UserDetailsModal; // Export the modal component
