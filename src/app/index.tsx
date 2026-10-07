import { Image, StatusBar, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function IndexScreen() {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Image
          source={require("../../assets/images/igen-connect-transparent.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return <Redirect href={token ? "/(tabs)" : "/login"} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 220,
    height: 110,
  },
});
