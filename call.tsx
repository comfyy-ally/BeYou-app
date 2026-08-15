import React, { useState, useEffect } from 'react';
import './CallScreen.css';

interface CallProps {
  callerName: string;
  callerAvatar: string;
  callType: 'audio' | 'video';
  onEndCall: () => void;
}

export const CallScreen: React.FC<CallProps> = ({
  callerName,
  callerAvatar,
  callType,
  onEndCall,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="call-screen-container">
      <div className="call-header">
        <div className="call-info">
          <h2>{callerName}</h2>
          <p className="call-status">
            {callDuration > 0 ? formatTime(callDuration) : 'Connecting...'}
          </p>
        </div>
      </div>

      <div className="call-media-viewport">
        {callType === 'video' && !isVideoOff ? (
          <div className="video-grid">
            <div className="remote-video-placeholder">
              <img src={callerAvatar} alt={callerName} className="avatar-large" />
            </div>
            <div className="local-video-preview">
              <span className="preview-label">You</span>
            </div>
          </div>
        ) : (
          <div className="audio-only-view">
            <div className="avatar-ring">
              <img src={callerAvatar} alt={callerName} className="avatar-large" />
            </div>
          </div>
        )}
      </div>

      <div className="call-controls-bar">
        <button
          className={`control-btn ${isMuted ? 'active' : ''}`}
          onClick={() => setIsMuted(!isMuted)}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        {callType === 'video' && (
          <button
            className={`control-btn ${isVideoOff ? 'active' : ''}`}
            onClick={() => setIsVideoOff(!isVideoOff)}
            title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
          >
            {isVideoOff ? '📷❌' : '📹'}
          </button>
        )}

        <button
          className="control-btn end-call-btn"
          onClick={onEndCall}
          title="End Call"
        >
         <span>📞❌</span>
        </button>
      </div>
    </div>
  );
};

export default CallScreen;
