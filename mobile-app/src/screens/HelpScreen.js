import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_VERSION, APP_SERVER_LABEL } from '../config';

const FAQ = [
  {
    q: 'Comment effectuer un pointage d\'arrivée ?',
    a: 'Allez dans l\'onglet "Affectations", sélectionnez votre événement du jour et appuyez sur "Pointage Arrivée". Assurez-vous d\'avoir activé la localisation.',
  },
  {
    q: 'Que faire si mon pointage échoue ?',
    a: 'Vérifiez que votre GPS est activé, que vous êtes dans la zone de l\'événement, et que votre connexion internet est active. Réessayez en attendant quelques secondes.',
  },
  {
    q: 'Comment signaler un incident ?',
    a: 'Utilisez le bouton rouge "SOS" ou le menu "Incident" depuis l\'écran d\'accueil. Décrivez la situation et envoyez votre position.',
  },
  {
    q: 'Pourquoi mon tracking GPS ne fonctionne pas ?',
    a: 'Assurez-vous d\'avoir accordé les permissions de localisation "Toujours" (arrière-plan). Sur Android, allez dans les Paramètres → Applications → Security Guard → Autorisations.',
  },
  {
    q: 'Comment voir mes affectations à venir ?',
    a: 'Dans l\'onglet "Affectations", vous trouverez toutes vos missions : en attente, confirmées et passées. Appuyez sur une affectation pour voir les détails.',
  },
  {
    q: 'Comment modifier mon profil ou ma photo ?',
    a: 'Allez dans "Paramètres" → "Modifier le profil". Vous pouvez changer votre prénom, nom, email, téléphone et photo de profil.',
  },
  {
    q: 'Comment changer mon mot de passe ?',
    a: 'Allez dans "Paramètres" → "Changer le mot de passe". Entrez votre mot de passe actuel puis choisissez un nouveau mot de passe de 8 caractères minimum.',
  },
  {
    q: 'Mon application est lente au démarrage, est-ce normal ?',
    a: 'Oui, le serveur peut prendre 30 à 60 secondes à se réveiller sur la version gratuite (cold start). C\'est normal, veuillez patienter.',
  },
];

const FaqItem = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{item.q}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#9ca3af"
        />
      </View>
      {expanded && (
        <Text style={styles.faqA}>{item.a}</Text>
      )}
    </TouchableOpacity>
  );
};

export default function HelpScreen({ navigation }) {
  const handleContact = () => {
    Alert.alert(
      'Contacter le support',
      'Souhaitez-vous envoyer un email à l\'administrateur ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer un email',
          onPress: () => Linking.openURL('mailto:admin@security-guard.com?subject=Support App Mobile'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Bannière */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="help-buoy" size={40} color="#0ea5e9" />
          </View>
          <Text style={styles.bannerTitle}>Aide & Support</Text>
          <Text style={styles.bannerSubtitle}>
            Trouvez des réponses aux questions fréquentes ou contactez votre administrateur.
          </Text>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Questions fréquentes</Text>
        <View style={styles.faqList}>
          {FAQ.map((item, idx) => (
            <React.Fragment key={idx}>
              <FaqItem item={item} />
              {idx < FAQ.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Contact */}
        <Text style={styles.sectionTitle}>Contacter le support</Text>
        <View style={styles.contactCard}>
          <TouchableOpacity style={styles.contactRow} onPress={handleContact}>
            <View style={[styles.contactIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="mail-outline" size={22} color="#2563eb" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>admin@security-guard.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Informations de l'app */}
        <Text style={styles.sectionTitle}>Informations de l'application</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Serveur</Text>
            <Text style={styles.infoValue}>{APP_SERVER_LABEL}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plateforme</Text>
            <Text style={styles.infoValue}>React Native / Expo</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Temps réel</Text>
            <Text style={styles.infoValue}>Socket.IO 4.x</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, paddingBottom: 60 },
  banner: { alignItems: 'center', backgroundColor: '#f0f9ff', borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#bae6fd' },
  bannerIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  bannerTitle: { fontSize: 20, fontWeight: '800', color: '#0c4a6e' },
  bannerSubtitle: { fontSize: 13, color: '#0369a1', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  faqList: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  faqItem: { padding: 16 },
  faqHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  faqA: { marginTop: 10, fontSize: 13, color: '#4b5563', lineHeight: 20, backgroundColor: '#f8fafc', borderRadius: 8, padding: 12 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 16 },
  contactCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  contactIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  contactValue: { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 2 },
  infoCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#9ca3af' },
});
