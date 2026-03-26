// App.tsx
import React, { useState, useEffect, createContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Alert, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Import screens
import LoginScreen from './src/screens/auth/LoginScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgottenPasswordScreen';
import ForgotUsernameScreen from './src/screens/auth/ForgottenUsername';
import HomeScreen from './src/screens/main/HomeScreen';
import FileUploadScreen from './src/screens/main/FileUploadScreen.tsx';
import PDFLibraryScreen from './src/screens/main/PDFLibraryScreen.tsx';
import ChatScreen from './src/screens/main/ChatScreen.tsx';

// Import services and types
import { ApiService } from './src/services/ApiService';
import { AuthService } from './src/services/AuthService';
import { PDF, ChatMessage, DatabaseStatusResponse, User } from './src/types';

// Navigation types
export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ForgotUsername: undefined;
};

export type MainStackParamList = {
  Home: undefined;
  FileUpload: undefined;
  PDFLibrary: undefined;
  Chat: { pdf: PDF };
};

export type TabParamList = {
  HomeTab: undefined;
  UploadTab: undefined;
  LibraryTab: undefined;
};

// Context type
export interface AppContextType {
  user: User | null;
  currentPDF: PDF | null;
  databaseStatus: DatabaseStatusResponse | null;
  setUser: (user: User | null) => void;
  setCurrentPDF: (pdf: PDF | null) => void;
  refreshDatabaseStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

// Create contexts
export const AppContext = createContext<AppContextType>({} as AppContextType);

// Create navigators
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainStack = createStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Main tab navigator
const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          
          switch (route.name) {
            case 'HomeTab':
              iconName = 'home';
              break;
            case 'UploadTab':
              iconName = 'upload-file';
              break;
            case 'LibraryTab':
              iconName = 'library-books';
              break;
            default:
              iconName = 'help';
          }
          
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="UploadTab" 
        component={FileUploadScreen}
        options={{ title: 'Upload' }}
      />
      <Tab.Screen 
        name="LibraryTab" 
        component={PDFLibraryScreen}
        options={{ title: 'Library' }}
      />
    </Tab.Navigator>
  );
};

// Main stack navigator
const MainNavigator: React.FC = () => {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <MainStack.Screen 
        name="Home" 
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <MainStack.Screen 
        name="FileUpload" 
        component={FileUploadScreen}
        options={{ title: 'Upload PDF' }}
      />
      <MainStack.Screen 
        name="PDFLibrary" 
        component={PDFLibraryScreen}
        options={{ title: 'PDF Library' }}
      />
      <MainStack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params?.pdf?.original_name || 'Chat',
        })}
      />
    </MainStack.Navigator>
  );
};

// Auth stack navigator
const AuthNavigator: React.FC = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen}
        options={{ headerShown: true, title: 'Reset Password' }}
      />
      <AuthStack.Screen 
        name="ForgotUsername" 
        component={ForgotUsernameScreen}
        options={{ headerShown: true, title: 'Recover Username' }}
      />
    </AuthStack.Navigator>
  );
};

// Main App component
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPDF, setCurrentPDF] = useState<PDF | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '454082200334-mvto2qlmj73e9kfememuoqatbd86hdi3.apps.googleusercontent.com', // Replace with your actual web client ID
      offlineAccess: true,
      hostedDomain: '',
      forceCodeForRefreshToken: true,
    });
    
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        const userInfo = await GoogleSignin.getCurrentUser();
        if (userInfo) {
          const user: User = {
            id: userInfo.user.id,
            email: userInfo.user.email,
            name: userInfo.user.name || '',
            photo: userInfo.user.photo || null,
          };
          setUser(user);
          await refreshDatabaseStatus();
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDatabaseStatus = async () => {
    try {
      const status = await ApiService.getDatabaseStatus();
      setDatabaseStatus(status);
    } catch (error) {
      console.error('Failed to refresh database status:', error);
    }
  };

  const logout = async () => {
    try {
      await AuthService.signOut();
      setUser(null);
      setCurrentPDF(null);
      setDatabaseStatus(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const contextValue: AppContextType = {
    user,
    currentPDF,
    databaseStatus,
    setUser,
    setCurrentPDF,
    refreshDatabaseStatus,
    logout,
  };

  if (isLoading) {
    // You can create a proper loading screen component
    return null;
  }

  return (
    <AppContext.Provider value={contextValue}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <NavigationContainer>
        {user ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </AppContext.Provider>
  );
};

export default App;

// Export types for other files
export type { PDF, ChatMessage, DatabaseStatusResponse, User };