require("dotenv").config();

module.exports = {
  expo: {
    name: "RoomBuddy",
    slug: "roombuddy",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0E0F12",
    },
    ios: {
      bundleIdentifier: "in.co.roombuddy.app",
      supportsTablet: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "RoomBuddy needs access to your photos to upload room photos for your listing.",
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
    },
    android: {
      package: "in.co.roombuddy.app",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0E0F12",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      googlePlacesApiKeyIos: process.env.GOOGLE_MAPS_API_KEY_IOS,
      googlePlacesApiKeyAndroid: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
    },
    plugins: ["@react-native-community/datetimepicker", "expo-font"],
  },
};
