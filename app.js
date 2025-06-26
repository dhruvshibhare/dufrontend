/**
 * Dumingle - Real-time Video Chat Application
 * Main JavaScript file handling WebRTC, Socket.io, and UI interactions
 */

import config from './config.js';

class DumingleApp {
    constructor() {
        // Initialize properties
        this.socket = null;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentPage = 'landing';
        this.userEmail = '';
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.chatMessages = [];
        this.unreadMessages = 0;
        this.connectionStats = {
            quality: 'good',
            packetsLost: 0,
            bitrate: 0
        };

        // WebRTC Configuration
        this.pcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application
     * Set up event listeners and socket connection
     */
    init() {
        console.log('🚀 Initializing Dumingle App');
        
        // Initialize Socket.io connection
        this.initSocket();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Show landing page initially
        this.showPage('landing');
        
        // Start stats polling
        this.startStatsPolling();
    }

    /**
     * Initialize Socket.io connection
     */
    initSocket() {
        // Connect to backend using config
        this.socket = io(config.backendUrl, {
            transports: ['websocket'],
            upgrade: false,
            cors: {
                origin: "*"
            }
        });
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.showNotification('Connection lost. Please refresh the page.', 'error');
        });
        
        this.socket.on('verification-success', () => {
            console.log('✅ Email verification successful');
            this.showPage('video-chat');
            this.initializeVideoChat();
        });
        
        this.socket.on('verification-failed', (data) => {
            console.log('❌ Email verification failed:', data.message);
            this.showEmailError(data.message);
        });
        
        this.socket.on('waiting-for-match', () => {
            console.log('⏳ Waiting for match');
            this.showLoadingOverlay(true);
            this.updateConnectionStatus('connecting', 'Finding partner...');
        });
        
        this.socket.on('matched', (data) => {
            console.log('🎯 Matched with partner:', data);
            this.showLoadingOverlay(false);
            this.updateConnectionStatus('connected', 'Connected');
            this.showNotification('Connected with a new partner!', 'success');
            this.initializePeerConnection();
        });
        
        this.socket.on('partner-disconnected', () => {
            console.log('👋 Partner disconnected');
            this.handlePartnerDisconnected();
        });
        
        // WebRTC signaling handlers
        this.socket.on('offer', (data) => {
            console.log('📞 Received offer');
            this.handleOffer(data.offer);
        });
        
        this.socket.on('answer', (data) => {
            console.log('📞 Received answer');
            this.handleAnswer(data.answer);
        });
        
        this.socket.on('ice-candidate', (data) => {
            console.log('🧊 Received ICE candidate');
            this.handleIceCandidate(data.candidate);
        });
        
        // Chat message handler
        this.socket.on('chat-message', (data) => {
            console.log('💬 Received message:', data.message);
            this.addChatMessage(data.message, false);
        });
        
        // Report handlers
        this.socket.on('report-submitted', (data) => {
            this.showNotification(data.message, 'success');
            this.hideReportModal();
        });
        
        this.socket.on('reported-disconnect', (data) => {
            this.showNotification(data.message, 'warning');
            this.handlePartnerDisconnected();
        });
        
        // Connection quality handler
        this.socket.on('partner-quality', (data) => {
            this.updateConnectionQuality(data.quality);
        });
    }

    /**
     * Set up all event listeners for the application
     */
    setupEventListeners() {
        // Landing page
        const startChatBtn = document.getElementById('start-chat-btn');
        if (startChatBtn) {
            startChatBtn.addEventListener('click', () => this.showPage('agreement'));
        }

        // Agreement page
        const backToHomeBtn = document.getElementById('back-to-home');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => this.showPage('landing'));
        }

        const agreementCheckbox = document.getElementById('agreement-checkbox');
        if (agreementCheckbox) {
            agreementCheckbox.addEventListener('click', this.toggleAgreementCheckbox.bind(this));
        }

        const verificationForm = document.getElementById('verification-form');
        if (verificationForm) {
            verificationForm.addEventListener('submit', this.handleEmailSubmit.bind(this));
        }

        const emailInput = document.getElementById('email-input');
        if (emailInput) {
            emailInput.addEventListener('input', this.clearEmailError.bind(this));
        }

        // Video chat controls
        const toggleVideoBtn = document.getElementById('toggle-video-btn');
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', this.toggleVideo.bind(this));
        }

        const toggleAudioBtn = document.getElementById('toggle-audio-btn');
        if (toggleAudioBtn) {
            toggleAudioBtn.addEventListener('click', this.toggleAudio.bind(this));
        }

        const nextPersonBtn = document.getElementById('next-person-btn');
        if (nextPersonBtn) {
            nextPersonBtn.addEventListener('click', this.nextPerson.bind(this));
        }

        const endChatBtn = document.getElementById('end-chat-btn');
        if (endChatBtn) {
            endChatBtn.addEventListener('click', this.endChat.bind(this));
        }

        // Chat functionality
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        const sendMessageBtn = document.getElementById('send-message-btn');
        if (sendMessageBtn) {
            sendMessageBtn.addEventListener('click', this.sendMessage.bind(this));
        }

        const toggleChatBtn = document.getElementById('toggle-chat-btn');
        if (toggleChatBtn) {
            toggleChatBtn.addEventListener('click', this.toggleChatSidebar.bind(this));
        }

        const mobileChatToggle = document.getElementById('mobile-chat-toggle');
        if (mobileChatToggle) {
            mobileChatToggle.addEventListener('click', this.toggleChatSidebar.bind(this));
        }

        // Report functionality
        const reportUserBtn = document.getElementById('report-user-btn');
        if (reportUserBtn) {
            reportUserBtn.addEventListener('click', this.showReportModal.bind(this));
        }

        const closeReportModal = document.getElementById('close-report-modal');
        if (closeReportModal) {
            closeReportModal.addEventListener('click', this.hideReportModal.bind(this));
        }

        const cancelReport = document.getElementById('cancel-report');
        if (cancelReport) {
            cancelReport.addEventListener('click', this.hideReportModal.bind(this));
        }

        const submitReport = document.getElementById('submit-report');
        if (submitReport) {
            submitReport.addEventListener('click', this.submitReport.bind(this));
        }

        // Report reason selection
        const reportReasons = document.querySelectorAll('input[name="report-reason"]');
        reportReasons.forEach(reason => {
            reason.addEventListener('change', this.updateReportSubmitButton.bind(this));
        });

        // Modal overlay clicks
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', this.hideReportModal.bind(this));
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // Window beforeunload
        window.addEventListener('beforeunload', this.cleanup.bind(this));
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        if (this.currentPage !== 'video-chat') return;

        // Ctrl/Cmd + shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'm':
                    e.preventDefault();
                    this.toggleAudio();
                    break;
                case 'e':
                    e.preventDefault();
                    this.toggleVideo();
                    break;
                case 'n':
                    e.preventDefault();
                    this.nextPerson();
                    break;
            }
        }

        // Escape key
        if (e.key === 'Escape') {
            const modal = document.getElementById('report-modal');
            if (modal && !modal.classList.contains('hidden')) {
                this.hideReportModal();
            }
        }
    }

    /**
     * Show specific page and hide others
     */
    showPage(pageName) {
        console.log(`📄 Showing page: ${pageName}`);
        
        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        
        // Show target page
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        this.currentPage = pageName;
    }

    /**
     * Toggle agreement checkbox
     */
    toggleAgreementCheckbox() {
        const checkbox = document.getElementById('agreement-checkbox');
        const checkIcon = checkbox.querySelector('.checkbox-check');
        const submitBtn = document.getElementById('join-chat-btn');
        
        checkbox.classList.toggle('checked');
        checkIcon.classList.toggle('hidden');
        
        const isChecked = checkbox.classList.contains('checked');
        const emailInput = document.getElementById('email-input');
        const hasEmail = emailInput.value.trim().length > 0;
        
        submitBtn.disabled = !(isChecked && hasEmail);
    }

    /**
     * Handle email form submission
     */
    handleEmailSubmit(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('email-input');
        const email = emailInput.value.trim();
        
        if (!this.validateCollegeEmail(email)) {
            this.showEmailError('Please enter a valid college email address (.edu or .ac.uk domain)');
            return;
        }
        
        this.userEmail = email;
        
        // Send verification request to server
        this.socket.emit('verify-and-join', { email });
    }

    /**
     * Validate college email format
     */
    validateCollegeEmail(email) {
        const collegeEmailRegex = /^[^\s@]+@[^\s@]+\.(edu|ac\.uk)$/i;
        return collegeEmailRegex.test(email);
    }

    /**
     * Show email validation error
     */
    showEmailError(message) {
        const errorDiv = document.getElementById('email-error');
        const errorText = errorDiv.querySelector('span');
        
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
        
        // Focus on email input
        const emailInput = document.getElementById('email-input');
        emailInput.focus();
    }

    /**
     * Clear email validation error
     */
    clearEmailError() {
        const errorDiv = document.getElementById('email-error');
        errorDiv.classList.add('hidden');
        
        // Update submit button state
        const emailInput = document.getElementById('email-input');
        const checkbox = document.getElementById('agreement-checkbox');
        const submitBtn = document.getElementById('join-chat-btn');
        
        const hasEmail = emailInput.value.trim().length > 0;
        const isChecked = checkbox.classList.contains('checked');
        
        submitBtn.disabled = !(hasEmail && isChecked);
    }

    /**
     * Initialize video chat functionality
     */
    async initializeVideoChat() {
        console.log('🎥 Initializing video chat');
        
        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Display local video
            const localVideo = document.getElementById('local-video');
            localVideo.srcObject = this.localStream;
            
            console.log('✅ Local media stream obtained');
            
        } catch (error) {
            console.error('❌ Error accessing media devices:', error);
            this.showNotification('Unable to access camera/microphone. Please check permissions.', 'error');
        }
    }

    /**
     * Initialize WebRTC peer connection
     */
    async initializePeerConnection() {
        console.log('🔗 Initializing peer connection');
        
        try {
            this.peerConnection = new RTCPeerConnection(this.pcConfig);
            
            // Add local stream tracks
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                console.log('📺 Received remote stream');
                this.remoteStream = event.streams[0];
                const remoteVideo = document.getElementById('remote-video');
                const placeholder = document.getElementById('remote-placeholder');
                
                remoteVideo.srcObject = this.remoteStream;
                placeholder.style.display = 'none';
            };
            
            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('🧊 Sending ICE candidate');
                    this.socket.emit('ice-candidate', { candidate: event.candidate });
                }
            };
            
            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                console.log('🔄 Connection state:', this.peerConnection.connectionState);
                this.updateConnectionStatus(this.peerConnection.connectionState, 
                    this.getConnectionStatusText(this.peerConnection.connectionState));
            };
            
            // Create and send offer
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.peerConnection.setLocalDescription(offer);
            this.socket.emit('offer', { offer });
            
            console.log('📞 Offer sent');
            
        } catch (error) {
            console.error('❌ Error creating peer connection:', error);
            this.showNotification('Failed to establish connection. Please try again.', 'error');
        }
    }

    /**
     * Handle received WebRTC offer
     */
    async handleOffer(offer) {
        try {
            if (!this.peerConnection) {
                await this.initializePeerConnection();
            }
            
            await this.peerConnection.setRemoteDescription(offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('answer', { answer });
            
            console.log('📞 Answer sent');
            
        } catch (error) {
            console.error('❌ Error handling offer:', error);
        }
    }

    /**
     * Handle received WebRTC answer
     */
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(answer);
            console.log('📞 Answer received and processed');
            
        } catch (error) {
            console.error('❌ Error handling answer:', error);
        }
    }

    /**
     * Handle received ICE candidate
     */
    async handleIceCandidate(candidate) {
        try {
            await this.peerConnection.addIceCandidate(candidate);
            console.log('🧊 ICE candidate added');
            
        } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
        }
    }

    /**
     * Toggle video on/off
     */
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isVideoEnabled = videoTrack.enabled;
                
                const videoBtn = document.getElementById('toggle-video-btn');
                const iconOn = videoBtn.querySelector('.icon-on');
                const iconOff = videoBtn.querySelector('.icon-off');
                
                if (this.isVideoEnabled) {
                    videoBtn.classList.add('active');
                    iconOn.classList.remove('hidden');
                    iconOff.classList.add('hidden');
                } else {
                    videoBtn.classList.remove('active');
                    iconOn.classList.add('hidden');
                    iconOff.classList.remove('hidden');
                }
                
                console.log(`📹 Video ${this.isVideoEnabled ? 'enabled' : 'disabled'}`);
            }
        }
    }

    /**
     * Toggle audio on/off
     */
    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isAudioEnabled = audioTrack.enabled;
                
                const audioBtn = document.getElementById('toggle-audio-btn');
                const iconOn = audioBtn.querySelector('.icon-on');
                const iconOff = audioBtn.querySelector('.icon-off');
                
                if (this.isAudioEnabled) {
                    audioBtn.classList.add('active');
                    iconOn.classList.remove('hidden');
                    iconOff.classList.add('hidden');
                } else {
                    audioBtn.classList.remove('active');
                    iconOn.classList.add('hidden');
                    iconOff.classList.remove('hidden');
                }
                
                console.log(`🎤 Audio ${this.isAudioEnabled ? 'enabled' : 'disabled'}`);
            }
        }
    }

    /**
     * Request next person
     */
    nextPerson() {
        console.log('⏭️ Requesting next person');
        this.cleanupPeerConnection();
        this.socket.emit('next-person');
        this.showNotification('Finding a new chat partner...', 'info');
        
        // Reset UI
        const remoteVideo = document.getElementById('remote-video');
        const placeholder = document.getElementById('remote-placeholder');
        remoteVideo.srcObject = null;
        placeholder.style.display = 'flex';
    }

    /**
     * End chat and return to landing
     */
    endChat() {
        console.log('🚪 Ending chat');
        this.cleanup();
        this.showPage('landing');
        this.showNotification('Chat ended successfully', 'info');
    }

    /**
     * Handle partner disconnection
     */
    handlePartnerDisconnected() {
        console.log('👋 Partner disconnected');
        this.showNotification('Your partner has disconnected', 'warning');
        
        // Reset remote video
        const remoteVideo = document.getElementById('remote-video');
        const placeholder = document.getElementById('remote-placeholder');
        remoteVideo.srcObject = null;
        placeholder.style.display = 'flex';
        
        // Clean up peer connection
        this.cleanupPeerConnection();
        
        // Update status
        this.updateConnectionStatus('connecting', 'Finding new partner...');
        this.showLoadingOverlay(true);
    }

    /**
     * Send chat message
     */
    sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (message && message.length > 0) {
            // Add to local chat
            this.addChatMessage(message, true);
            
            // Send to partner
            this.socket.emit('chat-message', { message });
            
            // Clear input
            chatInput.value = '';
            
            console.log('💬 Message sent:', message);
        }
    }

    /**
     * Add message to chat UI
     */
    addChatMessage(message, isSent) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message');
        messageDiv.classList.add(isSent ? 'sent' : 'received');
        
        const messageContent = document.createElement('div');
        messageContent.textContent = message;
        
        const messageTime = document.createElement('div');
        messageTime.classList.add('message-time');
        messageTime.textContent = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Update unread count if chat is closed and message is received
        if (!isSent && !this.isChatSidebarOpen()) {
            this.unreadMessages++;
            this.updateChatBadge();
        }
        
        // Remove welcome message if present
        const welcomeMsg = chatMessages.querySelector('.chat-welcome');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
    }

    /**
     * Toggle chat sidebar
     */
    toggleChatSidebar() {
        const sidebar = document.getElementById('chat-sidebar');
        sidebar.classList.toggle('open');
        
        // Reset unread messages when opening
        if (sidebar.classList.contains('open')) {
            this.unreadMessages = 0;
            this.updateChatBadge();
        }
    }

    /**
     * Check if chat sidebar is open
     */
    isChatSidebarOpen() {
        const sidebar = document.getElementById('chat-sidebar');
        return sidebar.classList.contains('open');
    }

    /**
     * Update chat notification badge
     */
    updateChatBadge() {
        const badge = document.querySelector('.chat-badge');
        if (this.unreadMessages > 0) {
            badge.textContent = this.unreadMessages > 9 ? '9+' : this.unreadMessages;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    /**
     * Show report modal
     */
    showReportModal() {
        const modal = document.getElementById('report-modal');
        modal.classList.remove('hidden');
        
        // Reset form
        const reasons = document.querySelectorAll('input[name="report-reason"]');
        reasons.forEach(reason => reason.checked = false);
        this.updateReportSubmitButton();
    }

    /**
     * Hide report modal
     */
    hideReportModal() {
        const modal = document.getElementById('report-modal');
        modal.classList.add('hidden');
    }

    /**
     * Update report submit button state
     */
    updateReportSubmitButton() {
        const submitBtn = document.getElementById('submit-report');
        const selectedReason = document.querySelector('input[name="report-reason"]:checked');
        submitBtn.disabled = !selectedReason;
    }

    /**
     * Submit user report
     */
    submitReport() {
        const selectedReason = document.querySelector('input[name="report-reason"]:checked');
        if (selectedReason) {
            this.socket.emit('report-user', { reason: selectedReason.value });
            console.log('🚨 User reported for:', selectedReason.value);
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(state, text) {
        const indicator = document.getElementById('connection-status');
        const statusText = indicator.querySelector('.status-text');
        
        // Remove existing state classes
        indicator.classList.remove('connecting', 'connected', 'disconnected');
        
        // Add new state class
        indicator.classList.add(state);
        statusText.textContent = text;
    }

    /**
     * Get human-readable connection status text
     */
    getConnectionStatusText(state) {
        switch (state) {
            case 'connecting': return 'Connecting...';
            case 'connected': return 'Connected';
            case 'disconnected': return 'Disconnected';
            case 'failed': return 'Connection Failed';
            case 'closed': return 'Connection Closed';
            default: return 'Unknown';
        }
    }

    /**
     * Update connection quality indicator
     */
    updateConnectionQuality(quality) {
        const qualityIndicator = document.getElementById('connection-quality');
        const qualityText = qualityIndicator.querySelector('span');
        
        qualityText.textContent = quality.charAt(0).toUpperCase() + quality.slice(1);
        
        // Update color based on quality
        qualityIndicator.classList.remove('good', 'fair', 'poor');
        qualityIndicator.classList.add(quality);
    }

    /**
     * Show/hide loading overlay
     */
    showLoadingOverlay(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        
        notification.classList.add('notification', type);
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
        
        console.log(`📢 Notification (${type}):`, message);
    }

    /**
     * Start polling server stats
     */
    startStatsPolling() {
        const updateStats = async () => {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                
                const onlineUsersEl = document.getElementById('online-users');
                const waitingUsersEl = document.getElementById('waiting-users');
                
                if (onlineUsersEl) onlineUsersEl.textContent = stats.connectedUsers || '--';
                if (waitingUsersEl) waitingUsersEl.textContent = stats.waitingUsers || '--';
                
            } catch (error) {
                console.warn('Failed to fetch stats:', error);
            }
        };
        
        // Update immediately and then every 10 seconds
        updateStats();
        setInterval(updateStats, 10000);
    }

    /**
     * Clean up peer connection
     */
    cleanupPeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
    }

    /**
     * Clean up all resources
     */
    cleanup() {
        console.log('🧹 Cleaning up resources');
        
        // Clean up peer connection
        this.cleanupPeerConnection();
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Disconnect socket
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dumingleApp = new DumingleApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('📱 Page is now hidden');
    } else {
        console.log('📱 Page is now visible');
    }
});