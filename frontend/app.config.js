require("dotenv").config();

module.exports = {
  expo: {
    name: "frontend",
    slug: "frontend",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
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
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
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
    plugins: ["@react-native-community/datetimepicker"],
  },
};
