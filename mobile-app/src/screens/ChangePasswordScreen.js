import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const getStrength = (pwd) => {
    if (!pwd) return { level: 0, label: '', color: '#e5e7eb' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const levels = [
      { level: 0, label: '', color: '#e5e7eb' },
      { level: 1, label: 'Faible', color: '#ef4444' },
      { level: 2, label: 'Moyen', color: '#f59e0b' },
      { level: 3, label: 'Bon', color: '#3b82f6' },
      { level: 4, label: 'Fort', color: '#10b981' },
    ];
    return levels[score];
  };

  const strength = getStrength(newPassword);

  const validate = () => {
    const errs = {};
    if (!currentPassword) errs.current = 'Mot de passe actuel requis';
    if (!newPassword) errs.new = 'Nouveau mot de passe requis';
    else if (newPassword.length < 8) errs.new = 'Minimum 8 caractères';
    else if (strength.level < 2) errs.new = 'Mot de passe trop faible';
    if (!confirmPassword) errs.confirm = 'Confirmation requise';
    else if (newPassword !== confirmPassword) errs.confirm = 'Les mots de passe ne correspondent pas';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      Alert.alert('Succès', 'Mot de passe modifié avec succès', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Impossible de changer le mot de passe';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  const PasswordInput = ({ label, value, onChangeText, show, setShow, errorKey, placeholder }) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrapper, errors[errorKey] && styles.inputWrapperError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(v) => { onChangeText(v); setErrors(p => ({ ...p, [errorKey]: undefined })); }}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          secureTextEntry={!show}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShow(!show)} style={styles.eyeBtn}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>
      {errors[errorKey] ? <Text style={styles.errorText}>{errors[errorKey]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Icon */}
          <View style={styles.iconSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={40} color="#7c3aed" />
            </View>
            <Text style={styles.title}>Changer le mot de passe</Text>
            <Text style={styles.subtitle}>Votre nouveau mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.</Text>
          </View>

          <PasswordInput
            label="Mot de passe actuel *"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            show={showCurrent}
            setShow={setShowCurrent}
            errorKey="current"
            placeholder="Entrez votre mot de passe actuel"
          />

          <PasswordInput
            label="Nouveau mot de passe *"
            value={newPassword}
            onChangeText={setNewPassword}
            show={showNew}
            setShow={setShowNew}
            errorKey="new"
            placeholder="Minimum 8 caractères"
          />

          {/* Force du mot de passe */}
          {newPassword.length > 0 && (
            <View style={styles.strengthBlock}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4].map(i => (
                  <View
                    key={i}
                    style={[styles.strengthBar, { backgroundColor: i <= strength.level ? strength.color : '#e5e7eb' }]}
                  />
                ))}
              </View>
              {strength.label ? <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text> : null}
            </View>
          )}

          <PasswordInput
            label="Confirmer le mot de passe *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            show={showConfirm}
            setShow={setShowConfirm}
            errorKey="confirm"
            placeholder="Répétez le nouveau mot de passe"
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Modifier le mot de passe</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, paddingBottom: 60 },
  iconSection: { alignItems: 'center', marginBottom: 32 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb' },
  inputWrapperError: { borderColor: '#ef4444' },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' },
  eyeBtn: { paddingHorizontal: 14 },
  errorText: { marginTop: 4, fontSize: 12, color: '#ef4444' },
  strengthBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: -8 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 50, textAlign: 'right' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7c3aed', borderRadius: 14, padding: 16, marginTop: 8 },
  saveBtnDisabled: { backgroundColor: '#c4b5fd' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
