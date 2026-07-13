require("dotenv").config();

module.exports = {
  expo: {
    name: "RoomBuddy",
    slug: "roombuddy",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
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
          "RoomBuddy needs access to your photos so you can upload pictures of your room when creating a listing — for example, photos of the bedroom and bathroom that guests see before booking.",
        NSCameraUsageDescription:
          "RoomBuddy uses your camera so you can take photos of your room while creating a listing — for example, snapping a picture of the bedroom to add to your listing.",
        NSLocationWhenInUseUsageDescription:
          "RoomBuddy uses your location to show rooms available near you — for example, listings within a few kilometres of where you are — and to set your city when you search for a stay. Location is only used while you are using the app and is never shared with hosts.",
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
      eas: {
        projectId: "9d31a02c-25e6-464d-bf93-78b061aa63cf",
      },
    },
    plugins: [
      "@react-native-community/datetimepicker",
      "expo-font",
      [
        "expo-notifications",
        {
          color: "#B85C38",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "RoomBuddy uses your location to show rooms available near you — for example, listings within a few kilometres of where you are — and to set your city when you search for a stay. Your location is used only while you are using the app and is never shared with hosts.",
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "RoomBuddy needs access to your photos so you can upload pictures of your room when creating a listing — for example, selecting photos of the bedroom and bathroom that guests see before booking.",
          cameraPermission:
            "RoomBuddy uses your camera so you can take photos of your room while creating a listing — for example, snapping a picture of the bedroom or bathroom to add to your listing so guests can see it before booking.",
          // We only capture photos, never audio/video.
          microphonePermission: false,
        },
      ],
    ],
  },
};
