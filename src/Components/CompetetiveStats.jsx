import { useState, useEffect } from "react";
import Spinner from "react-bootstrap/Spinner";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Accordion from "react-bootstrap/Accordion";
import axios from "axios";
import { API_CALLS } from "./helpers/API_CALLS";
import Table from "react-bootstrap/Table";
import rankLevels from "./helpers/rankLevels";

function CompetetiveStats() {
  const apiKey = import.meta.env.VITE_API_KEY;
  const [invalidText, setinvalidText] = useState(null);
  const [pgcrItems, setpgcrItems] = useState([]);
  const [bungieId, setBungieId] = useState("");
  const [player, setPlayer] = useState({});
  const [loading, setLoading] = useState(false);
  const mobileLayout = screen.width <= 800;
  const regEx = new RegExp(/.+#\d{4}$/);

  const gatherPlayerData = async (userBungieId) => {
    const [displayName, displayNameCode] = userBungieId.split("#");
    const data = JSON.stringify({
      displayName,
      displayNameCode,
    });

    let crossSaveProfile = "";
    const config = {
      method: "post",
      url: `${API_CALLS.COMMON_URL}${API_CALLS.GET_MEMBERSHIP_ID}`,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      data: data,
    };
    await axios(config)
      .then((response) => {
        crossSaveProfile = response.data.Response.find((profile) => {
          if (profile.crossSaveOverride === profile.membershipType)
            return profile.membershipType;
        });
        setPlayer({
          bungieName: displayName,
          bungieId: displayNameCode,
          membershipId: crossSaveProfile.membershipId,
          membershipType: crossSaveProfile.membershipType,
          isPublic: crossSaveProfile.isPublic,
        });
        // setpgcrItems([
        //   <Accordion.Item eventKey="0" key="0">
        //     <Accordion.Header>Some Game 1</Accordion.Header>
        //     <Accordion.Body>
        //       Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
        //       eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
        //       enim ad minim veniam, quis nostrud exercitation ullamco laboris
        //       nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
        //       reprehenderit in voluptate velit esse cillum dolore eu fugiat
        //       nulla pariatur. Excepteur sint occaecat cupidatat non proident,
        //       sunt in culpa qui officia deserunt mollit anim id est laborum.
        //     </Accordion.Body>
        //   </Accordion.Item>,
        // ]);
      })
      .catch(function (error) {
        console.log(error);
      });
    return crossSaveProfile;
  };

  const gatherCharactersForPlayer = async (profile) => {
    let profileWithIds = {};
    const config = {
      method: "get",
      url: `${API_CALLS.COMMON_URL}/Destiny2/${profile.membershipType}/Profile/${profile.membershipId}/?components=Profiles`,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    };
    await axios(config)
      .then((response) => {
        profileWithIds = {
          ...profile,
          characterIds: response.data.Response.profile.data.characterIds,
        };
      })
      .catch(function (error) {
        console.log(error);
      });
    return profileWithIds;
  };

  const gatherInstanceIds = async (profile) => {
    let instanceIds = [];
    const today = new Date();
    const checkDate = new Date(new Date().setDate(today.getDate() - 30));
    const characterIds = profile.characterIds;
    const baseConfig = {
      method: "get",

      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    };

    await Promise.all(
      characterIds.map((id) => {
        return axios({
          ...baseConfig,
          url: `${API_CALLS.COMMON_URL}/Destiny2/${profile.membershipType}/Account/${profile.membershipId}/Character/${id}/Stats/Activities/?mode=5`,
        });
      })
    ).then((responses) => {
      const activities = responses.map((response) => {
        return response.data.Response.activities;
      });
      activities.map((activity) => {
        activity.map((instance) => {
          if (new Date(instance.period) > checkDate) {
            instanceIds.push(instance.activityDetails.instanceId);
          }
        });
      });
    });
    return {
      ...profile,
      instanceIds,
    };
  };

  const getRank = async (playerEntry) => {
    const baseConfig = {
      method: "get",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    };
    const rankId = "3696598664";
    const membershipId = playerEntry.player.destinyUserInfo.membershipId;
    const membershipType = playerEntry.player.destinyUserInfo.membershipType;
    const [rankProgress] = await Promise.all([
      axios({
        ...baseConfig,
        url: `${API_CALLS.COMMON_URL}/Destiny2/${membershipType}/Profile/${membershipId}/?components=CharacterProgressions,Profiles`,
      }),
    ]);
    let progress;
    let step;
    try {
      if (rankProgress.data.Response.characterProgressions.data) {
        const characterId =
          rankProgress.data.Response.profile.data.characterIds[0];
        const rankLevel = rankLevels.Response.steps;
        progress =
          rankProgress.data.Response.characterProgressions.data[characterId]
            .progressions[rankId].currentProgress;
        step =
          rankProgress.data.Response.characterProgressions.data[characterId]
            .progressions[rankId].stepIndex;
        const playerRank = rankLevel[step];
        return {
          progress,
          rankDivision: playerRank.stepName,
          rankIconSrc: `https://www.bungie.net${playerRank.icon}`,
        };
      } else {
        return {
          progress: "private",
          rankDivision: "private",
          isPublic: false,
        };
      }
    } catch (e) {
      console.log(`ERROR: ${e}`);
    }
  };

  const getModeName = (mode) => {
    switch (mode) {
      case 43:
        return "Iron Banner Control";
      case 89:
        return "Competitive Control (3v3)";
      case 71:
        return "Competitive Clash (3v3)";
      case 84:
        return "Trials Of Osiris";
      default:
        return `tell lazy dev to add ${mode}`;
    }
  };

  const gatherPGCRs = async (profile) => {
    let instanceIds = profile.instanceIds;
    let PGCRs = [];
    const baseConfig = {
      method: "get",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    };

    await Promise.all(
      instanceIds.map((id) => {
        return axios({
          ...baseConfig,
          url: `${API_CALLS.COMMON_URL}/Destiny2/Stats/PostGameCarnageReport/${id}/ `,
        });
      })
    ).then(async (responses) => {
      for (let response of responses) {
        let teams = [];
        const mode = response.data.Response.activityDetails.mode;
        const playerEntries = response.data.Response.entries;
        const teamOnePlayers = [];
        const teamTwoPlayers = [];
        let period = response.data.Response.period;
        let modeName = getModeName(mode);
        try {
          teams = response.data.Response.teams.map((team) => {
            return {
              teamId: team.teamId,
              standing: {
                score: team.score.basic.displayValue,
                standing: team.standing.basic.displayValue,
              },
              players: [],
            };
          });

          //TODO: check ispublic to see if we can display the profile, finish building the table for the teams/players.
          for (let playerEntry of playerEntries) {
            const isPublic = playerEntry.player.destinyUserInfo.isPublic;
            if (!isPublic) {
              teams[0].teamId === playerEntry.values.team.basic.value
                ? teamOnePlayers.push({
                    bungieGlobalDisplayName:
                      playerEntry.player.destinyUserInfo
                        .bungieGlobalDisplayName,
                    isPublic,
                    teamId: playerEntry.values.team.basic.value,
                    kills: playerEntry.values.kills.basic.displayValue,
                    assists: playerEntry.values.assists.basic.displayValue,
                    deaths: playerEntry.values.deaths.basic.displayValue,
                    kdr: playerEntry.values.killsDeathsRatio.basic.displayValue,
                  })
                : teamTwoPlayers.push({
                    bungieGlobalDisplayName:
                      playerEntry.player.destinyUserInfo
                        .bungieGlobalDisplayName,
                    isPublic,
                    teamId: playerEntry.values.team.basic.value,
                    kills: playerEntry.values.kills.basic.displayValue,
                    assists: playerEntry.values.assists.basic.displayValue,
                    deaths: playerEntry.values.deaths.basic.displayValue,
                    kdr: playerEntry.values.killsDeathsRatio.basic.displayValue,
                  });
            } else {
              let rank;
              if (mode === 89 || mode === 71) {
                rank = await getRank(playerEntry);
                teams[0].teamId === playerEntry.values.team.basic.value
                  ? teamOnePlayers.push({
                      isPublic,
                      bungieGlobalDisplayName:
                        playerEntry.player.destinyUserInfo
                          .bungieGlobalDisplayName,
                      rank,
                      teamId: playerEntry.values.team.basic.value,
                      kills: playerEntry.values.kills.basic.displayValue,
                      assists: playerEntry.values.assists.basic.displayValue,
                      deaths: playerEntry.values.deaths.basic.displayValue,
                      kdr: playerEntry.values.killsDeathsRatio.basic
                        .displayValue,
                    })
                  : teamTwoPlayers.push({
                      isPublic,
                      bungieGlobalDisplayName:
                        playerEntry.player.destinyUserInfo
                          .bungieGlobalDisplayName,
                      rank,
                      teamId: playerEntry.values.team.basic.value,
                      kills: playerEntry.values.kills.basic.displayValue,
                      assists: playerEntry.values.assists.basic.displayValue,
                      deaths: playerEntry.values.deaths.basic.displayValue,
                      kdr: playerEntry.values.killsDeathsRatio.basic
                        .displayValue,
                    });
              } else {
                teams[0].teamId === playerEntry.values.team.basic.value
                  ? teamOnePlayers.push({
                      isPublic,
                      bungieGlobalDisplayName:
                        playerEntry.player.destinyUserInfo
                          .bungieGlobalDisplayName,
                      rank,
                      teamId: playerEntry.values.team.basic.value,
                      kills: playerEntry.values.kills.basic.displayValue,
                      assists: playerEntry.values.assists.basic.displayValue,
                      deaths: playerEntry.values.deaths.basic.displayValue,
                      kdr: playerEntry.values.killsDeathsRatio.basic
                        .displayValue,
                    })
                  : teamTwoPlayers.push({
                      isPublic,
                      bungieGlobalDisplayName:
                        playerEntry.player.destinyUserInfo
                          .bungieGlobalDisplayName,
                      rank,
                      teamId: playerEntry.values.team.basic.value,
                      kills: playerEntry.values.kills.basic.displayValue,
                      assists: playerEntry.values.assists.basic.displayValue,
                      deaths: playerEntry.values.deaths.basic.displayValue,
                      kdr: playerEntry.values.killsDeathsRatio.basic
                        .displayValue,
                    });
              }
            }
          }
          const consolidatedTeams = [
            {
              ...teams[0],
              players: teamOnePlayers,
            },
            {
              ...teams[1],
              players: teamTwoPlayers,
            },
          ];
          PGCRs.push({
            period,
            modeName,
            teams: consolidatedTeams,
          });
        } catch (e) {
          console.log(
            `!!!!!!!!!!!!!!!!!!!! ERROR: ${e} !!!!!!!!!!!!!!!!!!!!!!!`
          );
          console.log(response);
        }
      }
    });
    return {
      ...profile,
      PGCRs,
    };
  };

  const genTables = (team) => {
    {
      return team.players.map((player, index) => (
        <tr key={index + 100000000}>
          <td align="center">
            {player.isPublic ? (
              player?.rank === undefined ? (
                "NonComp"
              ) : (
                <div>
                  <img
                    src={player.rank.rankIconSrc}
                    alt={player.rank.rankDivision}
                    title={player.rank.rankDivision}
                    height="75rem"
                    width="75rem"
                  ></img>
                  <p>{player.rank.progress}</p>
                </div>
              )
            ) : (
              "Privated"
            )}
          </td>
          <td>{player.bungieGlobalDisplayName}</td>
          <td>{player.kills}</td>
          <td>{player.deaths}</td>
          <td>{player.assists}</td>
          <td>{player.kdr}</td>
        </tr>
      ));
    }
  };
  const finalizePGCRs = (payload) => {
    const accordionItems = payload.PGCRs.map((PGCR, index) => {
      const teamTables = PGCR.teams.map((team, index) => {
        return (
          mobileLayout ? <div>
          <h1 align="center">{team.standing.standing}</h1>
          <h1 align="center">{team.standing.score}</h1>
          <Table striped bordered hover key={index + 1000000000} style={{maxWidth: "90vw", tableLayout: 'fixed'}}>
            <thead>
              <tr key={index + 100} style={{width: "90vw"}}>
                <th>Rank</th>
                <th>Player</th>
                <th>Kills</th>
                <th>Deaths</th>
                <th>Assists</th>
                <th>KDA</th>
              </tr>
            </thead>
            <tbody>{genTables(team)}</tbody>
          </Table>
        </div> :
          <div class="col-6">
            <h1 align="center">{team.standing.standing}</h1>
            <h1 align="center">{team.standing.score}</h1>
            <Table striped bordered hover key={index + 1000000000} style={{maxWidth: "90vw"}}>
              <thead>
                <tr key={index + 100} style={{maxWidth: "90vw"}}>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Kills</th>
                  <th>Deaths</th>
                  <th>Assists</th>
                  <th>KDA</th>
                </tr>
              </thead>
              <tbody>{genTables(team)}</tbody>
            </Table>
          </div>
        );
      });
      return (
        <Accordion.Item eventKey={index} key={index}>
          <Accordion.Header>{PGCR.modeName} - {PGCR.period}</Accordion.Header>
            <Accordion.Body key={index + 100000}><Row>{teamTables}</Row></Accordion.Body>
        </Accordion.Item>
      );
    });
    setpgcrItems(accordionItems);
  };

  const handleClick = async () => {
    if (!regEx.test(bungieId)) {
      setinvalidText(
        <div className="text-danger">
          Please Enter a valid bungie ID that follows the format of My Bungie
          ID#1234
        </div>
      );
    } else {
      setLoading(true);
      setinvalidText(<div></div>);
      return Promise.resolve()
        .then(() => {
          return gatherPlayerData(bungieId);
        })
        .then((profile) => {
          return gatherCharactersForPlayer(profile);
        })
        .then((profile) => {
          return gatherInstanceIds(profile);
        })
        .then((profile) => {
          return gatherPGCRs(profile);
        })
        .then((payload) => {
          return finalizePGCRs(payload);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };
  useEffect(() => {}, [pgcrItems, player, screen.width]);
  return (
    <Container fluid="xs" className="py-4 px-3">
      {
        mobileLayout ? <div><Form.Label style={{width: "100vw"}}>Enter Bungie ID to see match history</Form.Label>
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
        {loading ? (
          <div>
            Loading <Spinner animation="border" size="sm" />
          </div>
        ) : player?.isPublic ? (
          <Accordion key="unique" >{pgcrItems}</Accordion>
        ) : player?.isPublic === undefined ? (
          <div></div>
        ) : (
          <div>Bungie Profile is set to private :(.</div>
        )}</div> : <Row className="mb-3">
        <Col xs={3}>
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
        <Col xs={9}>

          {loading ? (
            <div>
              Loading <Spinner animation="border" size="sm" />
            </div>
          ) : player?.isPublic ? (
            <Accordion key="unique">{pgcrItems}</Accordion>
          ) : player?.isPublic === undefined ? (
            <div></div>
          ) : (
            <div>Bungie Profile is set to private :(.</div>
          )}
        </Col>
      </Row>
      }
    </Container>
  );
}

export default CompetetiveStats;
