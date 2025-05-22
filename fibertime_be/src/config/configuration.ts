export default () => ({
    cors: {
      allowedOrigins: process.env.FRONTEND_URL?.split(',') || [],
      allowedMethods: process.env.ALLOWED_METHODS?.split(',') || [
        'GET',
        'HEAD',
        'PUT',
        'PATCH',
        'POST',
        'DELETE',
      ],
      allowCredentials: process.env.ALLOW_CREDENTIALS === 'true',
    },
  });