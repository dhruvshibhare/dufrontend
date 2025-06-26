const config = {
  backendUrl: process.env.NODE_ENV === 'production'
    ? 'https://dubackend.vercel.app/'  // Replace with your actual backend URL after deployment
    : 'http://localhost:3001'
};

export default config; 
