import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

export const api = axios.create({
  baseURL,
  timeout: 15000
});


