import React from "react";
import { StyleSheet, View, Text } from "react-native";

export default class App extends React.Component {
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>CodeSandbox + React Native = AWESOME!</Text>
        <Text style={styles.text}>Amazing that his works!</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgb(0, 0, 32)"
  },
  text: {
    color: "#fff",
    fontWeight: "bold"
  }
});
