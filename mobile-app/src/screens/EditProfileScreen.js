import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import useAuthStore from '../services/authStore';
import { authAPI, usersAPI } from '../services/api';

export default function EditProfileScreen({ navigation }) {
  const { user, checkAuth } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [avatar, setAvatar] = useState(user?.photo || null);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'Le prénom est requis';
    if (!form.lastName.trim()) errs.lastName = 'Le nom est requis';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Email invalide';
    }
    if (form.phone && !/^[0-9+\s\-()]{7,20}$/.test(form.phone)) {
      errs.phone = 'Numéro de téléphone invalide';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès à la galerie requis.', [
        { text: 'OK' },
        { text: 'Paramètres', onPress: () => {} },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      // Compression & resize
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 300, height: 300 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setAvatar(`data:image/jpeg;base64,${manipulated.base64}`);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      };
      if (avatar && avatar.startsWith('data:image')) {
        payload.photo = avatar;
      }
      await authAPI.updateProfile(payload);
      await checkAuth();
      Alert.alert('Succès', 'Profil mis à jour avec succès');
      navigation.goBack();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Impossible de mettre à jour le profil';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, field, placeholder, keyboardType, autoCapitalize }) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, errors[field] && styles.inputError]}
        value={form[field]}
        onChangeText={(v) => { setForm(p => ({ ...p, [field]: v })); setErrors(p => ({ ...p, [field]: undefined })); }}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType || 'default'}
        autoCapitalize={autoCapitalize || 'words'}
      />
      {errors[field] ? <Text style={styles.errorText}>{errors[field]}</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapper}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {(form.firstName[0] || '') + (form.lastName[0] || '')}
                </Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Appuyez pour changer la photo</Text>
        </View>

        <Field label="Prénom *" field="firstName" placeholder="Votre prénom" />
        <Field label="Nom *" field="lastName" placeholder="Votre nom" />
        <Field label="Email" field="email" placeholder="votre@email.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Téléphone" field="phone" placeholder="+212 6XX XXX XXX" keyboardType="phone-pad" autoCapitalize="none" />

        {/* CIN (lecture seule) */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>CIN (non modifiable)</Text>
          <View style={[styles.input, styles.inputReadonly]}>
            <Text style={styles.readonlyText}>{user?.cin || '—'}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, paddingBottom: 60 },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarWrapper: { position: 'relative' },
  avatarImg: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#2563eb' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#2563eb' },
  avatarInitials: { fontSize: 32, fontWeight: '800', color: '#2563eb' },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', borderRadius: 16, padding: 6, borderWidth: 2, borderColor: '#fff' },
  avatarHint: { marginTop: 8, fontSize: 12, color: '#9ca3af' },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', borderWidth: 1.5, borderColor: '#e5e7eb' },
  inputError: { borderColor: '#ef4444' },
  inputReadonly: { justifyContent: 'center' },
  readonlyText: { fontSize: 15, color: '#9ca3af' },
  errorText: { marginTop: 4, fontSize: 12, color: '#ef4444' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563eb', borderRadius: 14, padding: 16, marginTop: 8 },
  saveBtnDisabled: { backgroundColor: '#93c5fd' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
