'use client';
import { useEffect, useState } from 'react';
import { generateTVCode } from '../../utils/api';
import { Wrapper } from '../../component/wrapper';

export default function DevicePage() {
    const [code, setCode] = useState<string>('');

    useEffect(() => {
        const fetchCode = async () => {
            try {
                const response = await generateTVCode();
                setCode(response.message);
            } catch (error) {
                console.error('Error generating TV code:', error);
            }
        };
        fetchCode();
    }, []);

    return (
        <Wrapper>
            <div className="tv-page">
                <div className="tv-card">
                    <p className="fs-3 mb-3">On your phone go to <strong>mobile.fibertime.tv</strong> and enter this code</p>
                    <p className="tv-code text-center">{code || 'Loading...'}</p>
                    <p className="fs-5 mt-4">
                        For help: WhatsApp{' '}
                        <a
                            href="https://wa.me/+27602796353"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-underline"
                        >
                            +27 60 279 6353
                        </a>
                    </p>
                </div>
            </div>
        </Wrapper>
    );
}