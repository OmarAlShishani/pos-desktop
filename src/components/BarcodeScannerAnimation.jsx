import React, { useEffect, useState, useRef } from 'react';
import { Barcode, Loader2, ScanLine, Zap, CheckCircle2 } from 'lucide-react';

const BarcodeScannerAnimation = ({ scanningState, pendingScans }) => {
  const [showScanLine, setShowScanLine] = useState(false);
  const [laserPosition, setLaserPosition] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [particles, setParticles] = useState([]);
  const previousStateRef = useRef(scanningState);

  // Controls the scanning laser animation when in scanning state
  useEffect(() => {
    let animationInterval;

    if (scanningState === 'scanning') {
      setShowScanLine(true);
      // Animate the laser position
      animationInterval = setInterval(() => {
        setLaserPosition((prev) => {
          if (prev >= 100) return 0;
          return prev + 5;
        });
      }, 50);
    } else {
      setShowScanLine(false);
    }

    return () => {
      if (animationInterval) clearInterval(animationInterval);
    };
  }, [scanningState]);

  // Show success animation briefly when switching from processing to ready
  useEffect(() => {
    // Only show success animation when transitioning from processing to ready
    if (scanningState === 'ready' && previousStateRef.current === 'processing') {
      // Create particles for success animation
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        size: Math.random() * 3 + 2,
        x: 50 + (Math.random() * 40 - 20), // Center particles more
        y: 50 + (Math.random() * 40 - 20),
        tx: Math.random() * 60 - 30, // Variable direction
        ty: Math.random() * 60 - 30,
        angle: Math.random() * 360,
        speed: Math.random() * 2 + 1,
      }));

      setParticles(newParticles);
      setShowSuccess(true);

      const timeout = setTimeout(() => {
        setShowSuccess(false);
        setParticles([]);
      }, 800);

      return () => clearTimeout(timeout);
    }

    // Update previous state
    previousStateRef.current = scanningState;
  }, [scanningState]);

  const getBgColor = () => {
    if (showSuccess) return 'bg-gradient-to-r from-green-50 to-green-100';

    switch (scanningState) {
      case 'scanning':
        return 'bg-gradient-to-r from-blue-50 to-blue-100';
      case 'processing':
        return 'bg-gradient-to-r from-amber-50 to-amber-100';
      default:
        return 'bg-gradient-to-r from-gray-50 to-gray-100';
    }
  };

  const getBorderColor = () => {
    if (showSuccess) return 'border-green-200';

    switch (scanningState) {
      case 'scanning':
        return 'border-blue-200';
      case 'processing':
        return 'border-amber-200';
      default:
        return 'border-gray-200';
    }
  };

  const getTextColor = () => {
    if (showSuccess) return 'text-green-600';

    switch (scanningState) {
      case 'scanning':
        return 'text-blue-600';
      case 'processing':
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  };

  const getAnimationClass = () => {
    if (showSuccess) return 'success-animation';

    switch (scanningState) {
      case 'scanning':
        return 'glow-effect shadow-pulse';
      case 'processing':
        return 'animate-pulse';
      default:
        return pendingScans > 0 ? 'animate-pulse' : '';
    }
  };

  const getMessage = () => {
    if (showSuccess) return 'تمت القراءة!';

    switch (scanningState) {
      case 'scanning':
        return 'جاري المسح...';
      case 'processing':
        return 'معالجة الباركود...';
      default:
        return pendingScans > 0 ? `${pendingScans} في الانتظار` : 'جاهز للمسح';
    }
  };

  const getIcon = () => {
    if (showSuccess) {
      return <CheckCircle2 size={20} className={`${getTextColor()} transition-all duration-300`} />;
    }

    switch (scanningState) {
      case 'scanning':
        return <Barcode size={20} className={`${getTextColor()} transition-all duration-300`} />;
      case 'processing':
        return <Loader2 size={20} className={`${getTextColor()} animate-spin transition-all duration-300`} />;
      default:
        return pendingScans > 0 ? (
          <div className="relative">
            <span className={`${getTextColor()} font-bold transition-all duration-300`}>{pendingScans}</span>
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-ping"></span>
          </div>
        ) : (
          <Barcode size={20} className={`${getTextColor()} transition-all duration-300`} />
        );
    }
  };

  return (
    <div className={`barcode-scanner-container relative flex items-center gap-2 ${getBgColor()} ${getAnimationClass()} px-4 py-2 rounded-full transition-all duration-300 shadow-md border ${getBorderColor()} overflow-hidden min-w-[180px]`}>
      {/* Background effects */}
      {scanningState === 'scanning' && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-grid-pattern"></div>
        </div>
      )}

      {showScanLine && (
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute h-[2px] w-full bg-blue-400 shadow-lg shadow-blue-300 z-10"
            style={{
              top: `${laserPosition}%`,
              boxShadow: '0 0 8px 2px rgba(59, 130, 246, 0.5)',
            }}
          ></div>
        </div>
      )}

      {/* Icon and text */}
      <div className="z-10 flex items-center gap-2">
        <div className={`p-1.5 rounded-full ${scanningState === 'scanning' ? 'scale-110 bg-white bg-opacity-40' : ''} transition-transform duration-300`}>{getIcon()}</div>

        <span className={`${getTextColor()} font-medium text-sm z-10 transition-all duration-300`}>{getMessage()}</span>

        {scanningState === 'scanning' && (
          <div className="flex space-x-1 ml-1">
            <div className={`h-2 w-2 rounded-full ${getTextColor()} animate-bounce`} style={{ animationDelay: '0ms' }}></div>
            <div className={`h-2 w-2 rounded-full ${getTextColor()} animate-bounce`} style={{ animationDelay: '150ms' }}></div>
            <div className={`h-2 w-2 rounded-full ${getTextColor()} animate-bounce`} style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
      </div>

      {/* Success effect with particles */}
      {showSuccess && (
        <>
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="absolute h-full w-full opacity-30">
              <div className="absolute inset-0 rounded-full bg-green-400 animate-ping"></div>
            </div>
          </div>

          {/* Particles for success animation */}
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute bg-green-400 rounded-full"
              style={{
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                opacity: showSuccess ? 0.7 : 0,
                transform: `rotate(${particle.angle}deg)`,
                transition: 'opacity 0.5s ease-out',
                animation: `particleFade 0.8s ease-out forwards`,
                '--tx': `${particle.tx}px`,
                '--ty': `${particle.ty}px`,
              }}
            />
          ))}
        </>
      )}

      {/* Blinking dot for ready state */}
      {scanningState === 'ready' && !showSuccess && (
        <div className="absolute right-3 top-2 h-2 w-2 rounded-full bg-green-500">
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScannerAnimation;
