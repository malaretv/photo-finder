import React, { Component } from "react";
import styled from "styled-components";

import EXIF from "exif-js";

import olMap from "ol/canvasmap";
import olView from "ol/view";
import olFeature from "ol/feature";
import olProj from "ol/proj";
import olGeolocation from "ol/geolocation";
import olTileLayer from "ol/layer/tile";
import olVectorLayer from "ol/layer/vector";
import olOSMSource from "ol/source/osm";
import olVectorSource from "ol/source/vector";
import olPoint from "ol/geom/point";

import olStyle from "ol/style/style";
import olCircle from "ol/style/circle";
import olFill from "ol/style/fill";
import olStroke from "ol/style/stroke";

import "ol/ol.css";


// Max Bytes needed to read in EXIF data
const EXIF_HEADER_MAX_BYTES = 65635;


/**
 * Converts Degrees/Minutes/Seconds to decimal degrees
 */
const convertDMStoDD = (degrees, minutes, seconds, direction) => {
  let dd = degrees + minutes / 60 + seconds / (60 * 60);

  if (direction === "S" || direction === "W") {
    dd = dd * -1;
  } // Don't do anything for N or E
  return dd;
};


/**
 * Simple wrapper around FileReader to use Promise
 */
const readFileAsBuffer = (file, bytes) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    let blob = file;
    if (bytes) {
      blob = file.slice(0, bytes);
    }
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(blob);
  });


  /* Styled Components */

  const Map = styled.div`
    position: absolute;
    min-height: 100%;
    width: 100%;
    display: flex;
  `;

  const Errors = styled.div`
    position: absolute;
    top: 10px;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    flex-direction: column;
    height: 80%;
  `;

  const Error = styled.div`
    background: white;
    color: palevioletred;
    padding: 0.25em 1em;
    font-weight: bold;
    text-align: center;
    z-index: 2;
  `;
  const FileInputLabel = styled.label`
    border-radius: 3px;
    padding: 0.25em 1em;
    text-align: center;
    margin: 0 auto;
    width: 135px;
    background: palevioletred;
    color: white;
    border: 2px solid palevioletred;
    cursor: pointer;
    position: absolute;
    bottom: 70px;
    left: 0;
    right: 0;
    z-index: 3;
  `;
  const FileInput = styled.input`
    display: none;
  `;

class App extends Component {
  state = {
    errors: []
  };
  setImageError = error => this.setState({
    errors: this.state.errors.concat(error)
  });
  clearErrors = () => this.setState({ errors: [] });
  loadImage = async (file) => {
    if (!file) return this.setImageError("Not a valid file");
    console.log(file);
    try {
      const buffer = await readFileAsBuffer(file, EXIF_HEADER_MAX_BYTES);
      const exifData = EXIF.readFromBinaryFile(buffer);
      if (!exifData || !exifData.GPSLongitude || !exifData.GPSLatitude) {
        return this.setImageError(`${file.name}: No Geolocation data present.`);
      }
      const longitude = convertDMStoDD(
        ...exifData.GPSLongitude,
        exifData.GPSLongitudeRef
      );
      const latitude = convertDMStoDD(
        ...exifData.GPSLatitude,
        exifData.GPSLatitudeRef
      );
      const coords = [longitude, latitude];
      //const bearing = exifData.GPSBearing[0];
      if (longitude && latitude) {
        const projectedCoords = olProj.fromLonLat(coords);
        const positionFeature = new olFeature({
          geometry: new olPoint(projectedCoords)
        });
        this.vectorSource.addFeature(positionFeature);
        this.map.getView().animate({ zoom: 14, center: projectedCoords });
      }
    } catch (e) {
      return this.setImageError(`${file.name}: Error reading EXIF data`);
    }
  }
  handleImageLoad = evt => {
    this.clearErrors();
    const { files } = this.FileInput;
    for (var i = 0; i < files.length; i++) {
      this.loadImage(files[i]);
    }
  };
  initializeGeolocation() {
    const geolocation = new olGeolocation({
      projection: this.map.getView().getProjection()
    });
    var positionFeature = new olFeature();
    positionFeature.setStyle(
      new olStyle({
        image: new olCircle({
          radius: 6,
          fill: new olFill({
            color: "#3399CC"
          }),
          stroke: new olStroke({
            color: "#fff",
            width: 2
          })
        })
      })
    );

    geolocation.on("change:position", function() {
      var coordinates = geolocation.getPosition();
      positionFeature.setGeometry(
        coordinates ? new olPoint(coordinates) : null
      );
    });
    this.vectorSource.addFeature(positionFeature);
    geolocation.setTracking(true);
  }
  componentDidMount() {
    this.vectorSource = new olVectorSource();
    this.map = new olMap({
      target: "map",
      layers: [
        new olTileLayer({
          source: new olOSMSource()
        }),
        new olVectorLayer({
          source: this.vectorSource
        })
      ],
      view: new olView({
        center: [0, 0],
        zoom: 0
      })
    });
    this.initializeGeolocation();
  }
  render() {
    const { errors } = this.state;
    return (
      <Map id="map">
        <Errors>
          {errors && !!errors.length && errors.map(error => <Error>{error}</Error>)}
        </Errors>
        <FileInputLabel>
          Locate Photos!
          <FileInput
            type="file"
            accept="image/*"
            multiple="multiple"
            onChange={this.handleImageLoad}
            innerRef={el => (this.FileInput = el)}
          />
        </FileInputLabel>
      </Map>
    );
  }
}

export default App;
