import React, { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text, ToastAndroid,
  View
} from "react-native";
import Geolocation from "@react-native-community/geolocation";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import BackgroundFetch from "react-native-background-fetch";
import PushNotification from "react-native-push-notification";
import styled from "styled-components";

import {
  DANGER_ZONES,
  DURATION,
  HEIGHT,
  LATITUDE,
  LATITUDE_DELTA,
  LONGITUDE,
  LONGITUDE_DELTA,
  WIDTH
} from "./constants.ts";
import { requestPermissions } from "./permissions.tsx";
import { calculateDistanceVincenty, startVibration } from "./utils.tsx";

const Title = styled(Text)`
  font-size: 18px;
  font-weight: 600;
  color: black;
`;
const CoordsWrapper = styled(View)``;
const Subtitle = styled(Text)`
  color: black;
`;

const Spacer = styled(View)`
  margin: 8px 0;
`;
const Wrapper = styled(View)`
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 16px 20px;
  border-radius: 24px;
`;
const ContainerCoords = styled(View)`
  position: absolute;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: antiquewhite;
`;

export default function App() {
  const [location, setLocation] = useState({
    latitude: LATITUDE,
    longitude: LONGITUDE,
  });

  const defaultRegion = {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  };

  PushNotification.createChannel(
    {
      channelId: "8888",
      channelName: "RUMBLE",
      channelDescription: "Оповещения по опасной зоне",
      soundName: "default",
      importance: 4,
      vibrate: true,
    },
    (created) => {
      ToastAndroid.show(`CreateChannel returned '${created}'`, ToastAndroid.SHORT);
      console.log(`CreateChannel returned '${created}'`)
    } // callback вызывается после попытки создания канала
  );

  BackgroundFetch.scheduleTask({
    taskId: 'com.rumble',
    delay: 5000,
    forceAlarmManager: true,
    periodic: true
  });

  useEffect(() => {
    configureBackgroundFetch();
    requestPermissions();

    const watchId = Geolocation.watchPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setLocation({latitude, longitude});
        checkDangerZones({latitude, longitude});
      },
      error => console.log(error),
      {enableHighAccuracy: true, distanceFilter: 1},
    );

    return () => Geolocation.clearWatch(watchId);
  }, []);

  const configureBackgroundFetch = async () => {
    await BackgroundFetch.configure({
      minimumFetchInterval: 1,
      stopOnTerminate: false,
      startOnBoot: true,
      forceAlarmManager: true,
    }, async (taskId) => {
      ToastAndroid.show(`Received background-fetch event: ${taskId}`, ToastAndroid.SHORT);
      // console.log('[js] Received background-fetch event: ', taskId);
      checkDangerZones(location);
      BackgroundFetch.finish(taskId);
    }, ( error) => {
      // console.log(`[js] RNBackgroundFetch failed to start ${error}`);
      // ToastAndroid.show(`RNBackgroundFetch failed to start ${error}`, ToastAndroid.SHORT);
      // BackgroundFetch.finish();
    });

    const status = await BackgroundFetch.status();
    if (status === BackgroundFetch.STATUS_AVAILABLE) {
      ToastAndroid.show(`Background fetch is enabled`, ToastAndroid.SHORT);
    } else if (status === BackgroundFetch.STATUS_DENIED) {
      ToastAndroid.show(`Background fetch is denied`, ToastAndroid.SHORT);
    } else if (status === BackgroundFetch.STATUS_RESTRICTED) {
      ToastAndroid.show(`Background fetch is restricted`, ToastAndroid.SHORT);
    }
  };

  const checkDangerZones = (userPosition: any) => {
    console.log('start userPosition:' , userPosition);
    DANGER_ZONES.forEach(zone => {
      const isDangerZone = isUserInZone(userPosition, zone);
      if (isDangerZone) {
        Alert.alert('Внимание!', `Вы находитесь в в опасной зоне!`);
        startVibration(DURATION);
        PushNotification.localNotification({ // Отправляем уведомление
          channelId: "8888",
          title: "Внимание",
          message: "Вы находитесь в опасной зоне!",
        });
      }
    });
  };

  const isUserInZone = (userPosition: any, zone: any) => {
    const {latitude, longitude} = userPosition;
    const distance = calculateDistanceVincenty(
      latitude,
      longitude,
      zone.latitude,
      zone.longitude,
    );
    return distance <= zone.radius;
  };

  return (
    <SafeAreaView style={{height: HEIGHT, width: WIDTH}}>
      <>
        {location && (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={defaultRegion}
            zoomTapEnabled={true}
            zoomEnabled={true}
            zoomControlEnabled={true}>
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
            />

            {DANGER_ZONES.map(item => (
              <Circle
                key={item.id}
                center={{
                  latitude: item.latitude,
                  longitude: item.longitude,
                }}
                radius={item.radius}
                fillColor={'rgba(255, 0, 0, 0.2)'}
                strokeColor={'rgba(255, 0, 0, 0.5)'}
              />
            ))}
          </MapView>
        )}
        <Wrapper>
          <ContainerCoords>
            <Title>Моя локация:</Title>
            <CoordsWrapper>
              <Subtitle>Широта: {location.latitude}</Subtitle>
              <Subtitle>Долгота: {location.longitude}</Subtitle>
            </CoordsWrapper>
          </ContainerCoords>
        </Wrapper>
      </>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
