import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  loading: true,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false, error: null };
    case 'LOGIN_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      return { ...state, user: action.payload.user, token: action.payload.token, loading: false, error: null };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return { ...state, user: null, token: null, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then(res => dispatch({ type: 'SET_USER', payload: res.data }))
        .catch(() => {
          localStorage.removeItem('token');
          dispatch({ type: 'SET_LOADING', payload: false });
        });
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const login = (data) => dispatch({ type: 'LOGIN_SUCCESS', payload: data });
  const logout = () => dispatch({ type: 'LOGOUT' });

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {!state.loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
