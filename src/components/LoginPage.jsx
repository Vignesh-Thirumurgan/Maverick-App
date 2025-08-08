// src/components/LoginPage.jsx
import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { Button, Input, MessageBox } from './common/UIComponents.jsx';
import { useFirebase } from '../hooks/useFirebaseHook.jsx';

export function LoginPage({ setCurrentPage, onAuthSuccessAndMessageDismissed }) {
  const { auth, db, appId } = useFirebase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  console.log('LoginPage: Current isLoading state:', isLoading);

  const handleAuth = async (e) => {
    e.preventDefault();
    console.log('handleAuth: Initiating authentication. Setting isLoading to true.');
    setIsLoading(true);
    setShowMessageBox(false);

    try {
        if (!auth || !db) {
            console.error("handleAuth: Firebase services (auth or db) not initialized.");
            throw new Error("Firebase services not initialized.");
        }

        if (isLogin) {
            console.log('handleAuth: Attempting Firebase login...');
            await signInWithEmailAndPassword(auth, email, password);
            setMessage('Login successful!');
            setMessageType('success');
            setShowMessageBox(true);
            console.log('handleAuth: Login successful. MessageBox shown.');
        } else {
            console.log('handleAuth: Attempting Firebase registration...');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log('handleAuth: Creating user profile in Firestore...');
            const userProfileDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);
            await setDoc(userProfileDocRef, {
                email: user.email,
                userType: 'employee',
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
            console.log('handleAuth: Registration successful. Redirecting to profile setup.');
            onAuthSuccessAndMessageDismissed();
        }
    } catch (error) {
        console.error("handleAuth: Authentication error caught:", error);
        setMessage(`Authentication failed: ${error.message}`);
        setMessageType('error');
        setShowMessageBox(true);
    } finally {
        console.log('handleAuth: Finally block. Setting isLoading to false.');
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-950 to-indigo-950 flex items-center justify-center p-4 overflow-hidden relative"> {/* Darker, deeper blue background gradient */}
      {/* Global styles for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes gradient-shift {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          .gradient-text {
            background-image: linear-gradient(135deg, #4169E1, #00CED1, #40E0D0); /* Royal Blue, DarkTurquoise, Turquoise */
            background-size: 200% 200%;
            animation: gradient-shift 3s ease-in-out infinite;
          }
          .focus-input:focus {
            border-color: #40E0D080 !important; /* Turquoise accent on focus */
            box-shadow: 0 0 0 2px #40E0D020 !important;
            outline: none !important;
          }
          .custom-font {
            font-family: system-ui, Avenir, Helvetica, Arial, sans-serif !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          /* Keyframes for subtle floating animation with 3D depth */
          @keyframes float-3d {
            0% { transform: translateY(0px) rotateX(0deg) rotateY(0deg) translateZ(0px); }
            50% { transform: translateY(-15px) rotateX(10deg) rotateY(15deg) translateZ(20px); }
            100% { transform: translateY(0px) rotateX(0deg) rotateY(0deg) translateZ(0px); }
          }
          /* Keyframes for subtle rotation animation with 3D depth */
          @keyframes rotate-3d-subtle {
            0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
            100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg); }
          }
          /* Keyframes for subtle pulse/glow */
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 5px rgba(65, 105, 225, 0.2), 0 0 10px rgba(65, 105, 225, 0.1); }
            50% { box-shadow: 0 0 15px rgba(65, 105, 225, 0.4), 0 0 25px rgba(65, 105, 225, 0.2); }
          }
          /* New Keyframes for subtle background effects */
          @keyframes shimmer {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 0.3; }
          }
          @keyframes star-twinkle {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 1; }
          }
          @keyframes ripple {
            0% { transform: scale(0); opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
          }
          /* New Keyframes for digital grid and data lines */
          @keyframes grid-fade {
            0%, 100% { opacity: 0.05; }
            50% { opacity: 0.15; }
          }
          @keyframes data-flow {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes digital-pulse {
            0%, 100% { box-shadow: 0 0 5px rgba(0, 206, 209, 0.3); }
            50% { box-shadow: 0 0 15px rgba(0, 206, 209, 0.6); }
          }
          /* Keyframes for Skill Gap Indicators (flicker) */
          @keyframes flicker {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.2; }
          }
          /* Keyframes for Mastery Orbs (stronger pulse) */
          @keyframes strong-pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(0, 255, 255, 0.7); }
            50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(0, 255, 255, 1); }
          }
        `
      }} />

      {/* Animated Background Elements - Ethereal and darker */}
      <div className="absolute inset-0 overflow-hidden z-0" style={{ perspective: '1000px' }}> {/* Added perspective for 3D */}
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-blue-950 to-indigo-950" />

        {/* Subtle Digital Grid Overlay */}
        <div
          className="absolute inset-0 opacity-5 animate-[grid-fade_15s_ease-in-out_infinite]"
          style={{
            background: `
              linear-gradient(to right, rgba(0, 100, 255, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 100, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            filter: 'blur(0.5px)'
          }}
        />

        {/* Larger, slower, more blurred elements - now in blue-violet shades */}
        <div
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full blur-3xl animate-[float_20s_ease-in-out_infinite]"
          style={{ background: 'radial-gradient(circle, rgba(138, 43, 226, 0.08), rgba(75, 0, 130, 0.08))' }} /* BlueViolet to Indigo (Blue-Violet) */
        />
        <div
          className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full blur-3xl animate-[float_25s_ease-in-out_infinite_reverse]"
          style={{ background: 'radial-gradient(circle, rgba(147, 112, 219, 0.08), rgba(106, 90, 205, 0.08))' }} /* MediumPurple to SlateBlue (Blue-Violet) */
        />
        
        {/* Data Shards / Knowledge Fragments */}
        {Array.from({ length: 40 }, (_, i) => (
          <div
            key={`data-shard-${i}`}
            className="absolute w-5 h-5 backdrop-blur-sm animate-[float-3d_calc(3s_+_var(--delay))_ease-in-out_infinite] animate-[rotate-3d-subtle_calc(10s_+_var(--delay))_linear_infinite]"
            style={{
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              background: `linear-gradient(135deg, rgba(0, 150, 255, 0.2), rgba(0, 100, 200, 0.2))`, /* Varying blue shades */
              transformStyle: 'preserve-3d', animationDelay: `${i * 0.25}s`, '--delay': `${i * 0.25}s`,
              clipPath: `polygon(${Math.random() * 20}%, ${Math.random() * 20}%, ${80 + Math.random() * 20}%, ${Math.random() * 20}%, ${100}%, ${80 + Math.random() * 20}%, ${80 + Math.random() * 20}%, ${100}%, ${Math.random() * 20}%, ${100}%, ${Math.random() * 20}%, ${80 + Math.random() * 20}%)`, /* Irregular polygon */
              boxShadow: `0 0 5px rgba(0, 150, 255, 0.3)` // Subtle glow
            }}
          />
        ))}

        {/* Skill Gap Indicators / Fragmented Nodes - now in Blue-Violet */}
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={`gap-indicator-${i}`}
            className="absolute w-10 h-10 rounded-full border-2 border-purple-500/50 animate-[float-3d_calc(7s_+_var(--delay))_ease-in-out_infinite] animate-[flicker_calc(2s_+_var(--delay))_ease-in-out_infinite_alternate]"
            style={{
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              background: `transparent`,
              transformStyle: 'preserve-3d', animationDelay: `${i * 0.7}s`, '--delay': `${i * 0.7}s`,
              boxShadow: `0 0 10px rgba(138, 43, 226, 0.5)` // BlueViolet glow for gap
            }}
          />
        ))}

        {/* Progressive Flow Lines / Learning Paths */}
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={`learning-path-${i}`}
            className="absolute h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-[data-flow_calc(8s_+_var(--delay))_linear_infinite]"
            style={{
              top: `${Math.random() * 100}%`,
              width: `${60 + Math.random() * 40}%`, // Varying width
              animationDelay: `-${Math.random() * 8}s`, // Staggered start
              opacity: `${0.3 + Math.random() * 0.4}`, // Varying opacity
              filter: `blur(0.5px) drop-shadow(0 0 7px rgba(0, 206, 209, 0.6))`, // Stronger glow
              transform: `translateZ(${Math.random() * 50 - 25}px)`, // Subtle Z-depth
              '--delay': `${Math.random() * 8}s`
            }}
          />
        ))}

        {/* Mastery Orbs / Achieved Skill Nodes */}
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={`mastery-orb-${i}`}
            className="absolute w-8 h-8 rounded-full bg-cyan-400 animate-[float-3d_calc(9s_+_var(--delay))_ease-in-out_infinite] animate-[strong-pulse_calc(3s_+_var(--delay))_ease-in-out_infinite_alternate]"
            style={{
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              animationDelay: `-${Math.random() * 9}s`,
              opacity: `0.8`, // Consistently high opacity
              transformStyle: 'preserve-3d', // Important for spherical look
              boxShadow: `0 0 15px rgba(0, 255, 255, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.3)`, // Inner glow for sphere
              '--delay': `${Math.random() * 9}s`
            }}
          />
        ))}

        {/* Shimmering background layer (retained) */}
        <div
          className="absolute inset-0 bg-blue-500/5 animate-[shimmer_15s_ease-in-out_infinite_alternate]"
        />

        {/* Twinkling stars/particles (retained) */}
        {Array.from({ length: 100 }, (_, i) => (
          <div
            key={`star-${i}`}
            className="absolute w-0.5 h-0.5 rounded-full bg-white animate-[star-twinkle_calc(3s_+_var(--delay))_ease-in-out_infinite]"
            style={{
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`, '--delay': `${Math.random() * 5}s`
            }}
          />
        ))}

        {/* Subtle ripple effects from center (retained) */}
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={`ripple-${i}`}
            className="absolute w-0 h-0 rounded-full border-2 border-blue-400/30 animate-[ripple_10s_ease-out_infinite]"
            style={{
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              animationDelay: `${i * 2}s`, '--delay': `${i * 2}s`
            }}
          />
        ))}

        {/* Pulsating Digital Nodes (at random positions) (retained) */}
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={`digital-node-${i}`}
            className="absolute w-2 h-2 rounded-full bg-cyan-400 animate-[digital-pulse_calc(4s_+_var(--delay))_ease-in-out_infinite_alternate]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `-${Math.random() * 4}s`,
              opacity: `${0.4 + Math.random() * 0.4}`,
              '--delay': `${Math.random() * 4}s`,
              transform: `translateZ(${Math.random() * 30 - 15}px)` // Subtle Z-depth
            }}
          />
        ))}
      </div>

      {/* Main Login Card - Ensure this has a higher z-index and pointer-events: auto */}
      <div
        className="relative z-50"
        style={{ perspective: '1000px', pointerEvents: 'auto' }}
      >
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden animate-[pulse-glow_5s_ease-in-out_infinite]"> {/* Slightly darker card, added subtle pulse glow */}
          <div
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* CardHeader replacement */}
            <div className="text-center pb-8 p-6">
              <div>
                <h1 
                  className="bg-clip-text text-transparent gradient-text custom-font"
                  style={{
                    fontSize: '3.2em',
                    fontWeight: '500',
                    lineHeight: '1.1',
                    margin: '0 0 0.5rem 0',
                    fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                  }}
                >
                  Maverick
                </h1>
                <p 
                  className="text-white/70 custom-font"
                  style={{
                    fontSize: '1rem',
                    fontWeight: '400',
                    lineHeight: '1.5',
                    fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
                    margin: '0'
                  }}
                >
                  {isLogin ? 'Sign in to continue' : 'Create your account'}
                </p>
              </div>
            </div>

            {/* CardContent replacement */}
            <div className="p-6 pt-0">
              <form onSubmit={handleAuth} className="space-y-6" style={{ pointerEvents: 'auto' }}>
                {/* Email Field */}
                <div
                  className="space-y-2"
                >
                  <label
                    htmlFor="email" 
                    className="text-white/90 custom-font block"
                    style={{
                      fontSize: '1rem',
                      fontWeight: '500',
                      lineHeight: '1.5',
                      fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                    }}
                  >
                    Email
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4 transition-colors group-focus-within:text-[#40E0D0]" /> {/* Turquoise accent on focus */}
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/50 transition-all duration-300 focus-input custom-font"
                      style={{
                        fontSize: '1.0rem',
                        fontWeight: '400',
                        lineHeight: '1.5',
                        fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
                        pointerEvents: 'auto'
                      }}
                      placeholder="your@email.com"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div
                  className="space-y-2"
                >
                  <label
                    htmlFor="password" 
                    className="text-white/90 custom-font block"
                    style={{
                      fontSize: '1rem',
                      fontWeight: '500',
                      lineHeight: '1.5',
                      fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                    }}
                  >
                    Password
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4 transition-colors group-focus-within:text-[#40E0D0]" /> {/* Turquoise accent on focus */}
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white/5 border-white/20 text-white placeholder:text-white/50 transition-all duration-300 focus-input custom-font"
                      style={{
                        fontSize: '1.0rem',
                        fontWeight: '400',
                        lineHeight: '1.5',
                        fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
                        pointerEvents: 'auto'
                      }}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                      disabled={isLoading}
                      style={{ pointerEvents: 'auto' }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Login/Register Button */}
                <div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full text-white border-0 h-12 group relative overflow-hidden transition-all duration-300 transform hover:scale-105 custom-font"
                    style={{
                      background: `linear-gradient(135deg, #4169E1, #000080)`, /* Royal Blue to Navy */
                      fontSize: '1em',
                      fontWeight: '500',
                      lineHeight: '1.5',
                      fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
                      pointerEvents: 'auto'
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: `linear-gradient(135deg, #000080, #40E0D0)`, /* Navy to Turquoise on hover */
                      }}
                    />
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? (
                        <div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                        />
                      ) : (
                        <>
                          {isLogin ? 'Sign In' : 'Register'}
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                  </Button>
                </div>

                {/* Additional Links */}
                <div
                  className="text-center space-y-2 pt-4"
                >
                  <p 
                    className="text-white/60 custom-font"
                    style={{
                      fontSize: '1rem',
                      fontWeight: '400',
                      lineHeight: '1.5',
                      fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                    }}
                  >
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button 
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="hover:text-white/80 transition-colors underline underline-offset-2 custom-font" 
                      style={{ 
                        color: '#40E0D0', /* Turquoise for links */
                        fontSize: '1rem',
                        fontWeight: '500',
                        fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
                        pointerEvents: 'auto'
                      }}
                      disabled={isLoading}
                    >
                      {isLogin ? 'Sign up' : 'Login here'}
                    </button>
                  </p>
                  {isLogin && (
                    <button 
                      type="button"
                      className="text-white/60 hover:text-white/80 transition-colors underline underline-offset-2 custom-font"
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
                        pointerEvents: 'auto'
                      }}
                      disabled={isLoading}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Additional floating elements for depth */}
      <div
        className="absolute top-20 right-20 w-4 h-4 rounded-full"
        style={{ background: 'rgba(0, 0, 80, 0.3)' }} /* Dark Blue */
      />
      <div
        className="absolute bottom-32 left-16 w-6 h-6 rounded-full"
        style={{ background: 'rgba(0, 0, 40, 0.3)' }} /* Even Darker Blue */
      />
      {showMessageBox && (
        <MessageBox message={message} type={messageType} onConfirm={() => setShowMessageBox(false)} />
      )}
    </div>
  );
}
