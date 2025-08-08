// src/components/common/UIComponents.jsx
import React, { forwardRef, useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { XCircle, Info, CheckCircle, AlertTriangle, X } from 'lucide-react';

export const Button = forwardRef(({ children, className = '', icon: Icon, ...props }, ref) => {
    return (
        <button
            ref={ref}
            className={`flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 ease-in-out
                        bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${className}`}
            {...props}
        >
            {Icon && <Icon size={20} className={children ? "mr-2" : ""} />}
            {children}
        </button>
    );
});

export const Input = forwardRef(({ label, id, type = 'text', className = '', icon: Icon, ...props }, ref) => {
    return (
        <div className="relative">
            {label && (
                <label htmlFor={id} className="block text-gray-300 text-sm font-medium mb-2">
                    {label}
                </label>
            )}
            <div className="relative rounded-xl shadow-sm">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon size={20} className="text-gray-400" />
                    </div>
                )}
                <input
                    ref={ref}
                    id={id}
                    type={type}
                    className={`block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                                ${Icon ? 'pl-10' : ''} ${className}`}
                    {...props}
                />
            </div>
        </div>
    );
});

export const Textarea = forwardRef(({ label, id, rows = 4, className = '', ...props }, ref) => {
    return (
        <div>
            {label && (
                <label htmlFor={id} className="block text-gray-300 text-sm font-medium mb-2">
                    {label}
                </label>
            )}
            <textarea
                ref={ref}
                id={id}
                rows={rows}
                className={`block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                               ${className}`}
                {...props}
            ></textarea>
        </div>
    );
});

export const Select = forwardRef(({ label, id, options, className = '', ...props }, ref) => {
    return (
        <div>
            {label && (
                <label htmlFor={id} className="block text-gray-300 text-sm font-medium mb-2">
                    {label}
                </label>
            )}
            <select
                ref={ref}
                id={id}
                className={`block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                               appearance-none pr-8 cursor-pointer ${className}`}
                {...props}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
});

export const MessageBox = ({ message, type = 'info', onConfirm }) => {
    const iconMap = {
        info: <Info size={24} className="text-blue-400" />,
        success: <CheckCircle size={24} className="text-green-400" />,
        warning: <AlertTriangle size={24} className="text-yellow-400" />,
        error: <XCircle size={24} className="text-red-400" />,
    };

    const titleMap = {
        info: 'Information',
        success: 'Success!',
        warning: 'Warning!',
        error: 'Error!',
    };

    const bgColorMap = {
        info: 'bg-blue-900',
        success: 'bg-green-900',
        warning: 'bg-yellow-900',
        error: 'bg-red-900',
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className={`rounded-xl shadow-2xl w-full max-w-sm p-6 border border-gray-700 ${bgColorMap[type]}`}>
                <div className="flex items-center justify-center mb-4">
                    {iconMap[type]}
                    <h3 className="text-xl font-bold text-white ml-3">{titleMap[type]}</h3>
                </div>
                <p className="text-gray-200 text-center mb-6">{message}</p>
                <Button onClick={onConfirm} className="w-full bg-blue-600 hover:bg-blue-700">
                    OK
                </Button>
            </div>
        </div>
    );
};

export const LoadingPage = ({ message = 'Loading, please wait...' }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-4">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
            <p className="text-lg text-gray-300">{message}</p>
        </div>
    );
};

export const ProgressBar = ({ progress }) => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const progressColor = clampedProgress < 30 ? 'bg-red-500' : clampedProgress < 70 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${progressColor}`}
                style={{ width: `${clampedProgress}%` }}
                role="progressbar"
                aria-valuenow={clampedProgress}
                aria-valuemin="0"
                aria-valuemax="100"
            ></div>
        </div>
    );
};

export const Modal = ({ onClose, title, children }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navItems = [
        { name: 'Dashboard', page: 'dashboard' },
        { name: 'Profile', page: 'profileSetup' },
        { name: 'Assessment', page: 'assessment' },
        { name: 'Learning', page: 'learningPlatform' },
        { name: 'Leaderboard', page: 'leaderboard' },
    ];

    return (
        <nav className="bg-gray-900 p-4 shadow-lg">
            <div className="container mx-auto flex justify-between items-center">
                <div className="text-white text-2xl font-bold">Maverick</div>

                <div className="hidden md:flex items-center space-x-6">
                    {navItems.map(item => (
                        <Button
                            key={item.name}
                            type="button"
                            className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2"
                        >
                            {item.name}
                        </Button>
                    ))}
                    <Button
                        type="button"
                        className="bg-blue-600 hover:bg-blue-700 text-sm px-4 py-2"
                    >
                        Login / Register
                    </Button>
                </div>

                <div className="md:hidden">
                    <button type="button" onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white focus:outline-none">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                    </button>
                </div>
            </div>

            {isMenuOpen && (
                <div className="md:hidden absolute top-0 left-0 w-full bg-gray-900 bg-opacity-95 z-40 py-4">
                    <div className="flex flex-col items-center space-y-4">
                        {navItems.map(item => (
                            <Button
                                key={item.name}
                                type="button"
                                className="bg-gray-800 hover:bg-gray-700 w-11/12"
                            >
                                {item.name}
                            </Button>
                        ))}
                        <Button
                            type="button"
                            className="bg-blue-600 hover:bg-blue-700 w-11/12"
                        >
                            Login / Register
                        </Button>
                        <Button
                            type="button"
                            onClick={() => setIsMenuOpen(false)}
                            className="bg-gray-700 hover:bg-gray-600 w-11/12"
                        >
                            Close Menu
                        </Button>
                    </div>
                </div>
            )}
        </nav>
    );
};
