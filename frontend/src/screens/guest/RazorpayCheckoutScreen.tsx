import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import type { GuestStackParamList } from '../../navigation/types';
import { verifyPayment } from '../../services/payments';

type Nav = NativeStackNavigationProp<GuestStackParamList, 'RazorpayCheckout'>;
type Rt = RouteProp<GuestStackParamList, 'RazorpayCheckout'>;

export default function RazorpayCheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { bookingId, bookingCode, order } = route.params;

  const [verifying, setVerifying] = useState(false);

  const html = useMemo(() => buildCheckoutHtml(order, bookingCode), [order, bookingCode]);

  async function onMessage(e: WebViewMessageEvent) {
    let data: any;
    try { data = JSON.parse(e.nativeEvent.data); } catch { return; }

    if (data.type === 'payment_success') {
      setVerifying(true);
      try {
        await verifyPayment({
          orderId: data.razorpay_order_id,
          paymentId: data.razorpay_payment_id,
          signature: data.razorpay_signature,
        });
        navigation.replace('BookingSuccess', { bookingId, bookingCode });
      } catch (err: any) {
        Alert.alert(
          'Verification failed',
          err?.response?.data?.error || 'We could not verify the payment. Please contact support.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } finally {
        setVerifying(false);
      }
    } else if (data.type === 'payment_cancelled') {
      Alert.alert('Payment cancelled', 'You can retry payment from your bookings.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else if (data.type === 'payment_error') {
      Alert.alert('Payment failed', data.message || 'Something went wrong.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete payment</Text>
        <View style={{ width: 26 }} />
      </View>

      <WebView
        source={{ html, baseUrl: 'https://api.razorpay.com' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loaderText}>Loading payment gateway...</Text>
          </View>
        )}
        style={styles.webview}
      />

      {verifying && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.overlayText}>Verifying payment...</Text>
            <Text style={styles.overlaySub}>Please don't close the app.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function buildCheckoutHtml(order: any, bookingCode: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RoomBuddy Payment</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #f7f9fa; padding: 40px 20px; text-align: center; }
    .container { max-width: 360px; margin: 60px auto; background: white; border-radius: 12px; padding: 32px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .logo { font-size: 22px; font-weight: 700; color: #0D7377; margin-bottom: 8px; }
    .accent { color: #FF6B4A; }
    .booking { font-size: 14px; color: #5F7285; margin-bottom: 24px; }
    .amount { font-size: 32px; font-weight: 700; color: #1A2B3C; margin-bottom: 24px; }
    button { width: 100%; padding: 14px; background: #0D7377; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .hint { font-size: 12px; color: #94A3B8; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Room<span class="accent">Buddy</span></div>
    <div class="booking">Booking ${bookingCode}</div>
    <div class="amount">₹${(order.amount / 100).toLocaleString('en-IN')}</div>
    <button id="payBtn">Pay Now</button>
    <div class="hint">Secured by Razorpay</div>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function post(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }
    function startCheckout() {
      var options = {
        key: ${JSON.stringify(order.razorpay_key_id)},
        order_id: ${JSON.stringify(order.order_id)},
        amount: ${order.amount},
        currency: ${JSON.stringify(order.currency)},
        name: "RoomBuddy",
        description: "Booking ${bookingCode}",
        theme: { color: "#0D7377" },
        handler: function(response) {
          post({
            type: "payment_success",
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });
        },
        modal: { ondismiss: function() { post({ type: "payment_cancelled" }); } }
      };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(response) {
        post({ type: "payment_error", message: response.error && response.error.description });
      });
      rzp.open();
    }
    document.getElementById('payBtn').onclick = startCheckout;
    setTimeout(startCheckout, 400);
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: 60, paddingBottom: SPACING.md,
    backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, ...FONTS.semibold, color: COLORS.text },
  webview: { flex: 1, backgroundColor: COLORS.surface },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },
  loaderText: { marginTop: SPACING.md, color: COLORS.textSec, ...FONTS.medium },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  overlayCard: {
    backgroundColor: COLORS.bg, padding: SPACING.lg, borderRadius: RADIUS.lg,
    alignItems: 'center', minWidth: 240,
  },
  overlayText: { marginTop: SPACING.md, fontSize: 16, ...FONTS.semibold, color: COLORS.text },
  overlaySub: { marginTop: 4, fontSize: 13, color: COLORS.textSec },
});