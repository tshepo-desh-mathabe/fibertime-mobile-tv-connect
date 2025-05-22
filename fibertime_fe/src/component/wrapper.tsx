'use client';
import { ReactNode } from 'react';

export const Wrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className='d-flex flex-column align-items-center justify-content-center min-vh-100' style={{ backgroundColor: '#212529', color: '#FFFFFF' }}>
      <h2 className='display-4 fw-bold mb-4' style={{ color: '#FFD814' }}>fibertime</h2>
      {children}
    </div>
  );
};