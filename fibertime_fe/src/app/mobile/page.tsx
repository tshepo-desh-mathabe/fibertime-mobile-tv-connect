'use client';
import { useState } from 'react';
import { requestOTP, login, getDevice, connectDevice, checkConnectionStatus } from '../../utils/api';
import { isNull, isErrorResponse } from '../../utils/generic.helper';
import { Wrapper } from '../../component/wrapper';

type BundleInfo = {
    deviceCode: string;
    deviceExpiresAt: string;
    bundle: {
        remainingDays: number;
        remainingHours: number;
    };
};

export default function MobilePage() {
    const [step, setStep] = useState<'login' | 'verify' | 'connect' | 'connecting' | 'details'>('login');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [code, setCode] = useState('');
    const [bearerToken, setBearerToken] = useState('');
    const [bundle, setBundle] = useState<BundleInfo | null>(null);

    // Step 2: Login
    const handleRequestOTP = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        requestOTP(phoneNumber).then(res => {
            if (!isNull(res.message)) {
                if (Array.isArray(res.message)) {
                    alert(res.message[0]);
                } else {
                    alert(`Please remember this OTP: ${res.message}`);
                    setStep('verify');
                }
            }
        }).catch(error => {
            console.error('Something went wrong:', error);
            alert('Error requesting OTP');
        });
    };

    // Step 3: Verify OTP and get token
    const handleSignIn = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        login(phoneNumber, otp).then(res => {
            const isError = isErrorResponse(res);
            if (!isError) {
                const token = res.token?.startsWith('Bearer ') ? res.token.slice(7) : res.token;
                setBearerToken(token || '');
                setStep('connect');
            }
        }).catch(error => {
            console.error('Something went wrong:', error);
            alert('Sorry you could not verify yourself');
        });
    };

    // Step 4: Enter Code and Connect
    const handleConnect = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (!code || code.length < 4) {
            alert('Please enter a valid device code (at least 4 characters)');
            return;
        }

        setStep('connecting');
        getDevice(code, bearerToken)
            .then((response) => {
                if (isErrorResponse(response)) {
                    throw new Error('Device not found');
                }
                return connectDevice(code, phoneNumber, bearerToken);
            })
            .then((response) => {
                if (isErrorResponse(response)) {
                    throw new Error('Connection failed');
                }
                return checkConnectionStatus(code, bearerToken);
            })
            .then((res) => {
                if (!isNull(res.message)) {
                    const errorMessage = Array.isArray(res.message) ? res.message[0] : res.message;
                    alert(errorMessage);
                    setStep('connect');
                } else {
                    setBundle(res);
                    setStep('details');
                }
            })
            .catch((error) => {
                console.error('Connection error:', error);
                alert(error.message || 'Sorry! We cannot connect your device right now');
                setStep('connect');
            });
    };

    // Format date for connection details
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const day = date.getUTCDate();
            const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
            const year = date.getUTCFullYear();
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            return `${day} ${month} ${year} ${hours}:${minutes}`;
        } catch (error) {
            console.error('Date formatting error:', error);
            return 'Invalid date';
        }
    };

    return (
        <Wrapper>
            <div className="card bg-white text-black p-4 shadow-lg">
                {step === 'login' && (
                    <>
                        <h3 className="fs-4 mb-3">Log in to connect to WiFi</h3>
                        <form>
                            <div className='mb-3'>
                                <label htmlFor='phoneNumber' className='form-label'>Enter your phone number below</label>
                                <input
                                    id='phoneNumber'
                                    type='text'
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder='e.g. +27602796353'
                                    className='form-control'
                                />
                            </div>
                            <button
                                type='submit'
                                onClick={handleRequestOTP}
                                className='btn btn-primary'
                            >
                                Next
                            </button>
                        </form>
                    </>
                )}

                {step === 'verify' && (
                    <>
                        <h3 className="fs-4 mb-3">Enter the OTP sent to your phone</h3>
                        <form>
                            <div className='mb-3'>
                                <input
                                    id='otp'
                                    type='text'
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder='Enter OTP'
                                    className='form-control'
                                />
                            </div>
                            <button type='submit' onClick={handleSignIn} className='btn btn-primary' style={{ marginRight: '5px' }}>Verify</button>
                            <button type='button' className='btn btn-secondary' onClick={() => setStep('login')}>Back</button>
                        </form>
                    </>
                )}

                {step === 'connect' && (
                    <>
                        <h3 className="fs-4 mb-3">Enter the four digit code on the TV or device screen</h3>
                        <form>
                            <div className='mb-3'>
                                <div className="otp-input">
                                    {[...Array(4)].map((_, index) => (
                                        <input
                                            key={index}
                                            type='text'
                                            maxLength={1}
                                            value={code[index] || ''}
                                            onChange={(e) => {
                                                const newCode = code.split('');
                                                newCode[index] = e.target.value;
                                                setCode(newCode.join(''));
                                            }}
                                            className='form-control'
                                        />
                                    ))}
                                </div>
                            </div>
                            <button
                                type='submit'
                                onClick={handleConnect}
                                className='btn btn-primary'
                                disabled={!code || code.length < 4}
                            >
                                Connect
                            </button>
                        </form>
                    </>
                )}

                {step === 'connecting' && (
                    <>
                        <div className='spinner-border text-dark' role='status'>
                            <span className='visually-hidden'>Loading...</span>
                        </div>
                        <span>Connecting...</span>
                    </>
                )}

                {step === 'details' && (
                    <>
                        {bundle === null ? (
                            <span className="text-gray-500">
                                We could not retrieve your bundle info. If the TV is connected, 
                                you should be good for now!
                            </span>
                        ) : (
                            <>
                                <div className="mb-4 p-3" style={{ backgroundColor: '#FFD814' }}>
                                    <span className="block">Connected!</span>
                                    <strong className="text-black">{bundle.deviceCode}</strong>
                                    <br />
                                    <span>Device</span>
                                </div>
                                <div className="mb-4">
                                    <span className="block">{bundle.bundle.remainingDays} days {bundle.bundle.remainingHours} hours...</span>
                                    <strong>Remaining subscription:</strong>
                                </div>
                                <div>
                                    <span className="block">Check your active bundles</span>
                                    <a
                                        href="https://wa.me/+27602796353"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-decoration-underline"
                                    >
                                        WhatsApp us on +27 60 279 6353
                                    </a>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </Wrapper>
    );
}