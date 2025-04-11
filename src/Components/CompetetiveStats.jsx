import { useState, useEffect } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Accordion from "react-bootstrap/Accordion";
import axios from "axios";
import { API_CALLS } from './helpers/API_CALLS';

function CompetetiveStats() {
  const [invalidText, setinvalidText] = useState(null);
  const [pgcrItems, setpgcrItems] = useState([]);
  const [bungieId, setBungieId] = useState('');
  const [player, setPlayer] = useState({
    bungieName: '',
    bungieId: 0,
    membershipId: 0,
    charactersIds: [],
    membershipeType: -1,
  })
  const regEx = new RegExp(/.+#\d{4}$/);
  // The format for the matches after we pull everything
  //   <Accordion.Item eventKey="0" key="0">
  //   <Accordion.Header>Some Game 1</Accordion.Header>
  //   <Accordion.Body>
  //     Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
  //     tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
  //     veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
  //     commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
  //     velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
  //     occaecat cupidatat non proident, sunt in culpa qui officia deserunt
  //     mollit anim id est laborum.
  //   </Accordion.Body>
  // </Accordion.Item>,
  // <Accordion.Item eventKey="1" key="1">
  //   <Accordion.Header>Some Game 2</Accordion.Header>
  //   <Accordion.Body>some body</Accordion.Body>
  // </Accordion.Item>

  const gatherPlayerData = async (userBungieId) => {
    let [ displayName, displayNameCode] = userBungieId.split('#');
    let data = JSON.stringify({
      displayName,
      displayNameCode,
    });    

    const commonUrl = "https://www.bungie.net/Platform";
    let config = {
      method: "post",
      url: `${API_CALLS.COMMON_URL}${API_CALLS.GET_MEMBERSHIP_ID}`,
      headers: {
        "x-api-key": "//////////////////////////",
        "Content-Type": "application/json",
      },
      data: data,
    };

    axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        setpgcrItems([
          <Accordion.Item eventKey="0" key="0">
            <Accordion.Header>Some Game 1</Accordion.Header>
            <Accordion.Body>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </Accordion.Body>
          </Accordion.Item>,
        ]);
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  const handleClick = async (event) => {
    if (!regEx.test(bungieId)) {
      setinvalidText(<div className="text-danger">Please Enter a valid bungie ID that follows the format of My Bungie ID#1234</div>);
    } else {
      setinvalidText(<div></div>);
      await gatherPlayerData(bungieId);
    }
  };
  useEffect(() => {}, [pgcrItems]);
  return (
    <Container fluid="xs" className="py-4 px-3">
      <Row className="mb-3">
        <Col xs={4}>
          <Form.Label>Enter Bungie ID to see match history</Form.Label>
          <InputGroup hasValidation>
            <Form.Control
              required
              id="userBungieId"
              placeholder="Enter Bungie ID here..."
              aria-label="bungieIdInput"
              type="text"
              pattern=".+#\d{4}$"
              onChange={(e) => {
                setBungieId(e.target.value);
              }}
            />
            <Button
              variant="outline-primary"
              type="button"
              onClick={handleClick}
            >
              Submit
            </Button>
          </InputGroup>
            {invalidText}
        </Col>
        <Col xs={8}>
          <Accordion>{pgcrItems}</Accordion>
        </Col>
      </Row>
    </Container>
  );
}

export default CompetetiveStats;
