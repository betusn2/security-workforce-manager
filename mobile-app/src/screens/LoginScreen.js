import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../services/authStore';
import { wakeUpServer } from '../services/api';

const LoginScreen = ({ navigation }) => {
  const [loginMode, setLoginMode] = useState('agent'); // 'agent', 'supervisor', ou 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cin, setCin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'ready' | 'waking'
  const { login, loginByCin, isLoading, error, clearError } = useAuthStore();

  // Réveiller le serveur au montage
  useEffect(() => {
    const wake = async () => {
      try {
        const r = await fetch(`https://security-guard-backend-w3qv.onrender.com/api/health`, { signal: AbortSignal.timeout(5000) });
        if (r.ok) { setServerStatus('ready'); return; }
      } catch (_) {}
      setServerStatus('waking');
      await wakeUpServer();
      setServerStatus('ready');
    };
    wake();
  }, []);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    clearError();
    const result = await login(email.trim(), password);

    if (result.success) {
      navigation.replace('Main');
    } else {
      Alert.alert('Erreur de connexion', result.error || 'Email ou mot de passe incorrect');
    }
  };

  const handleCinLogin = async () => {
    if (!cin) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro CIN');
      return;
    }

    clearError();
    // Déterminer le userType basé sur le mode de connexion
    const userType = loginMode === 'agent' ? 'agent' : 'supervisor';
    const result = await loginByCin(cin.toUpperCase(), null, userType);

    if (result.success) {
      navigation.replace('CheckIn');
    } else {
      Alert.alert('Erreur', result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>SGM</Text>
            </View>
            <Text style={styles.title}>Security Guard Mobile</Text>
            <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>
          </View>

          {/* Indicateur statut serveur */}
          {serverStatus !== 'ready' && (
            <View style={styles.serverStatus}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.serverStatusText}>
                {serverStatus === 'waking'
                  ? '⏳ Démarrage du serveur (~30s)...'
                  : '🔄 Vérification de la connexion...'}
              </Text>
            </View>
          )}

          {/* Mode de connexion toggle - 3 options */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, loginMode === 'agent' && styles.modeButtonActive]}
              onPress={() => { setLoginMode('agent'); clearError(); }}
            >
              <Ionicons
                name="shield-outline"
                size={16}
                color={loginMode === 'agent' ? '#fff' : '#2563eb'}
              />
              <Text style={[styles.modeButtonText, loginMode === 'agent' && styles.modeButtonTextActive]}>
                Agents
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, loginMode === 'supervisor' && styles.modeButtonActive]}
              onPress={() => { setLoginMode('supervisor'); clearError(); }}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={loginMode === 'supervisor' ? '#fff' : '#2563eb'}
              />
              <Text style={[styles.modeButtonText, loginMode === 'supervisor' && styles.modeButtonTextActive]}>
                Responsables
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, loginMode === 'admin' && styles.modeButtonActive]}
              onPress={() => { setLoginMode('admin'); clearError(); }}
            >
              <Ionicons
                name="key-outline"
                size={16}
                color={loginMode === 'admin' ? '#fff' : '#2563eb'}
              />
              <Text style={[styles.modeButtonText, loginMode === 'admin' && styles.modeButtonTextActive]}>
                Admins
              </Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.form}>
            {loginMode === 'admin' ? (
              <>
                <View style={styles.roleInfo}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#2563eb" />
                  <Text style={styles.roleInfoText}>
                    Réservé aux administrateurs et utilisateurs
                  </Text>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mot de passe"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleEmailLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Se connecter</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.demoInfo}>
                  <Text style={styles.demoTitle}>Compte administrateur:</Text>
                  <Text style={styles.demoText}>admin@security.com</Text>
                  <Text style={styles.demoText}>Admin123!</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.roleInfo}>
                  <Ionicons 
                    name={loginMode === 'agent' ? 'shield-outline' : 'people-outline'} 
                    size={20} 
                    color="#2563eb" 
                  />
                  <Text style={styles.roleInfoText}>
                    {loginMode === 'agent' 
                      ? 'Réservé aux agents pour le pointage d\'entrée/sortie'
                      : 'Réservé aux responsables pour le pointage d\'entrée/sortie'
                    }
                  </Text>
                </View>

                <View style={styles.cinInfo}>
                  <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
                  <Text style={styles.cinInfoText}>
                    Entrez votre CIN pour effectuer le pointage d'entrée/sortie
                  </Text>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="card-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Numéro CIN"
                    value={cin}
                    onChangeText={setCin}
                    autoCapitalize="characters"
                    maxLength={20}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleCinLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Pointage</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.cinNote}>
                  <Text style={styles.cinNoteText}>
                    Utilisation réservée aux agents et responsables affectés à un événement aujourd'hui ou dans les 2 prochaines heures.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563eb',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  serverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  serverStatusText: {
    color: '#fff',
    fontSize: 13,
    fontStyle: 'italic',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: '#fff',
  },
  modeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modeButtonTextActive: {
    color: '#2563eb',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 50,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  demoInfo: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  demoTitle: {
    color: '#666',
    marginBottom: 4,
    fontSize: 12,
  },
  demoText: {
    color: '#2563eb',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  roleInfoText: {
    flex: 1,
    color: '#1e40af',
    fontSize: 13,
    fontWeight: '500',
  },
  cinInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  cinInfoText: {
    flex: 1,
    color: '#1e40af',
    fontSize: 13,
  },
  cinNote: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  cinNoteText: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
  },
});

export default LoginScreen;
