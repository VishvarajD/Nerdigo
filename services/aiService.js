const OpenAI = require('openai');
require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set in environment variables');
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
    
});

async function generateAIRoadmap(field, level, goals) {
    try {
        console.log('=== Starting AI Roadmap Generation ===');
        console.log('Input parameters:', { field, level, goals });
        console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

        if (!process.env.OPENAI_API_KEY) {
            console.log('No API key found, using fallback');
            const fallback = generateFallbackRoadmap(field, level);
            return { ...fallback, isFallback: true };
        }

        // Define the prompt here
        const prompt = `
        Create a detailed learning roadmap for ${field} at ${level} level.
        User's goals: ${goals || 'General proficiency in the field'}

        The roadmap should be practical and actionable, with specific focus on:
        1. Progressive skill development
        2. Industry-relevant technologies
        3. Practical projects and hands-on learning
        4. Current best practices and tools
        5. Career-oriented milestones

        Format the response as a JSON object with the following structure:
        {
            "title": "Roadmap title",
            "description": "Brief overview",
            "steps": [
                {
                    "title": "Step title",
                    "description": "Detailed explanation",
                    "resources": [
                        {
                            "name": "Resource name",
                            "url": "Resource URL",
                            "type": "Resource type (video/article/course)"
                        }
                    ],
                    "timeEstimate": "Estimated completion time",
                    "order": Number
                }
            ]
        }

        For ${field}, ensure to include:
        - Industry-standard tools and technologies
        - Security best practices
        - Hands-on projects
        - Certification recommendations where applicable
        - Latest trends and technologies
        
        Make the response detailed but ensure it's valid JSON format.
        `;

        console.log('Preparing OpenAI request...');
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    "role": "system",
                    "content": "You are an expert educational consultant specializing in creating detailed, practical learning roadmaps. Focus on current industry standards and best practices."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        console.log('OpenAI response received');
        
        try {
            const roadmapData = JSON.parse(completion.choices[0].message.content);
            console.log('Successfully parsed AI response');
            return { ...roadmapData, isFallback: false };
        } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            console.log('AI Response:', completion.choices[0].message.content);
            const fallback = generateFallbackRoadmap(field, level);
            return { ...fallback, isFallback: true };
        }

    } catch (error) {
        console.error('=== AI Generation Error ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        if (error.response) {
            console.error('OpenAI API Error:', error.response.data);
        }
        
        console.log('Falling back to template system');
        const fallback = generateFallbackRoadmap(field, level);
        return { ...fallback, isFallback: true };
    }
}

// Fallback function in case OpenAI API fails
function generateFallbackRoadmap(field, level) {
    const fallbackRoadmaps = {
        'web-development': {
            'Beginner': {
                title: "Web Development Fundamentals",
                description: "Comprehensive web development learning path for beginners",
                steps: [
                    {
                        title: "HTML Fundamentals",
                        description: "Learn the building blocks of web pages including semantic HTML, forms, and basic structure",
                        resources: [
                            {
                                name: "MDN HTML Guide",
                                url: "https://developer.mozilla.org/en-US/docs/Learn/HTML",
                                type: "documentation"
                            },
                            {
                                name: "HTML Crash Course",
                                url: "https://www.youtube.com/watch?v=UB1O30fR-EE",
                                type: "video"
                            }
                        ],
                        timeEstimate: "2 weeks",
                        order: 1
                    },
                    {
                        title: "CSS Basics",
                        description: "Master styling with CSS including layouts, flexbox, and responsive design",
                        resources: [
                            {
                                name: "CSS Tricks",
                                url: "https://css-tricks.com",
                                type: "article"
                            },
                            {
                                name: "Flexbox Froggy",
                                url: "https://flexboxfroggy.com/",
                                type: "interactive"
                            }
                        ],
                        timeEstimate: "3 weeks",
                        order: 2
                    },
                    {
                        title: "JavaScript Essentials",
                        description: "Learn core JavaScript concepts including DOM manipulation and events",
                        resources: [
                            {
                                name: "JavaScript.info",
                                url: "https://javascript.info/",
                                type: "documentation"
                            },
                            {
                                name: "FreeCodeCamp JS Course",
                                url: "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/",
                                type: "course"
                            }
                        ],
                        timeEstimate: "4 weeks",
                        order: 3
                    }
                ]
            },
            'Intermediate': {
                title: "Advanced Web Development",
                description: "Take your web development skills to the next level",
                steps: [
                    {
                        title: "Frontend Frameworks",
                        description: "Learn React.js fundamentals and state management",
                        resources: [
                            {
                                name: "React Documentation",
                                url: "https://reactjs.org/docs/getting-started.html",
                                type: "documentation"
                            }
                        ],
                        timeEstimate: "4 weeks",
                        order: 1
                    }
                    // Add more intermediate steps...
                ]
            }
        },
        'data-science': {
            'Beginner': {
                title: "Data Science Foundations",
                description: "Start your journey in data science",
                steps: [
                    {
                        title: "Python Programming",
                        description: "Learn Python basics for data science",
                        resources: [
                            {
                                name: "Python for Data Science",
                                url: "https://www.datacamp.com/courses/intro-to-python-for-data-science",
                                type: "course"
                            }
                        ],
                        timeEstimate: "3 weeks",
                        order: 1
                    }
                    // Add more data science steps...
                ]
            }
        },
        'machine-learning': {
            'Beginner': {
                title: "Machine Learning Fundamentals",
                description: "Start your journey into Machine Learning and AI",
                steps: [
                    {
                        title: "Mathematics Foundations",
                        description: "Learn essential mathematics for ML including linear algebra, calculus, and statistics",
                        resources: [
                            {
                                name: "Khan Academy Linear Algebra",
                                url: "https://www.khanacademy.org/math/linear-algebra",
                                type: "course"
                            },
                            {
                                name: "Statistics and Probability",
                                url: "https://www.coursera.org/learn/probability-theory-statistics",
                                type: "course"
                            }
                        ],
                        timeEstimate: "4 weeks",
                        order: 1
                    },
                    {
                        title: "Python for ML",
                        description: "Master Python libraries for Machine Learning (NumPy, Pandas, Scikit-learn)",
                        resources: [
                            {
                                name: "Google's Python ML Course",
                                url: "https://developers.google.com/machine-learning/crash-course",
                                type: "course"
                            }
                        ],
                        timeEstimate: "3 weeks",
                        order: 2
                    }
                ]
            }
        },
        'mobile-development': {
            'Beginner': {
                title: "Mobile App Development Basics",
                description: "Learn to build mobile applications",
                steps: [
                    {
                        title: "React Native Fundamentals",
                        description: "Build cross-platform mobile apps with React Native",
                        resources: [
                            {
                                name: "React Native Documentation",
                                url: "https://reactnative.dev/docs/getting-started",
                                type: "documentation"
                            },
                            {
                                name: "React Native Course",
                                url: "https://www.udemy.com/course/react-native-the-practical-guide",
                                type: "course"
                            }
                        ],
                        timeEstimate: "4 weeks",
                        order: 1
                    }
                ]
            }
        },
        'cybersecurity': {
            'Beginner': {
                title: "Cybersecurity Fundamentals",
                description: "Start your career in cybersecurity",
                steps: [
                    {
                        title: "Network Security Basics",
                        description: "Learn fundamental networking and security concepts",
                        resources: [
                            {
                                name: "CompTIA Security+",
                                url: "https://www.comptia.org/certifications/security",
                                type: "course"
                            }
                        ],
                        timeEstimate: "6 weeks",
                        order: 1
                    }
                ]
            }
        },
        'blockchain': {
            'Beginner': {
                title: "Blockchain Development",
                description: "Learn blockchain and smart contract development",
                steps: [
                    {
                        title: "Blockchain Basics",
                        description: "Understand blockchain fundamentals and cryptocurrencies",
                        resources: [
                            {
                                name: "Blockchain Basics",
                                url: "https://www.coursera.org/learn/blockchain-basics",
                                type: "course"
                            }
                        ],
                        timeEstimate: "3 weeks",
                        order: 1
                    }
                ]
            }
        },
        'game-development': {
            'Beginner': {
                title: "Game Development Fundamentals",
                description: "Start creating your own games",
                steps: [
                    {
                        title: "Unity Basics",
                        description: "Learn game development with Unity Engine",
                        resources: [
                            {
                                name: "Unity Learn",
                                url: "https://learn.unity.com",
                                type: "platform"
                            }
                        ],
                        timeEstimate: "4 weeks",
                        order: 1
                    }
                ]
            }
        },
        'cloud-computing': {
            'Beginner': {
                title: "Cloud Computing Essentials",
                description: "Master cloud platforms and services",
                steps: [
                    {
                        title: "AWS Fundamentals",
                        description: "Learn Amazon Web Services basics",
                        resources: [
                            {
                                name: "AWS Training",
                                url: "https://aws.amazon.com/training",
                                type: "platform"
                            }
                        ],
                        timeEstimate: "4 weeks",
                        order: 1
                    }
                ]
            }
        }
    };

    // Make sure we return a properly structured object
    const defaultRoadmap = {
        title: `${field} Learning Path`,
        description: `Basic ${field} curriculum`,
        steps: [
            {
                title: "Getting Started",
                description: "Begin your learning journey",
                resources: [
                    {
                        name: "General Learning Resources",
                        url: "https://www.freecodecamp.org",
                        type: "platform"
                    }
                ],
                timeEstimate: "1 week",
                order: 1
            }
        ]
    };

    return fallbackRoadmaps[field]?.[level] || defaultRoadmap;
}

module.exports = { generateAIRoadmap }; 