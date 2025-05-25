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
import compMapNames from "./helpers/compMapNames";
import _ from "lodash";

//provide more details about code and reasoning behind specific code

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
        crossSaveProfile =
          response.data.Response[0].crossSaveOverride === 0
            ? response.data.Response[0]
            : response.data.Response.find((profile) => {
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
    let instances = [];
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
          url: `${API_CALLS.COMMON_URL}/Destiny2/${profile.membershipType}/Account/${profile.membershipId}/Character/${id}/Stats/Activities/?mode=5&count=50`,
        });
      })
    ).then((responses) => {
      //TODO:
      //1: pull referenceId for map details using this call /Platform/Destiny2/Manifest/DestinyActivityDefinition/${referenceId}/
      //2: pull player standing to display on accordion header
      responses.map((response) => {
        try {
          response.data.Response.activities.map((instance) => {
            if (new Date(instance.period) > checkDate) {
              instances.push({
                instanceId: instance.activityDetails.instanceId,
                personalStanding: instance.values.standing.basic.displayValue,
              });
            }
          });
        } catch (e) {
          console.log(e);
        }
      });
    });
    return {
      ...profile,
      instances,
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
    const rankProgress = await axios({
      ...baseConfig,
      url: `${API_CALLS.COMMON_URL}/Destiny2/${membershipType}/Profile/${membershipId}/?components=CharacterProgressions,Profiles`,
    });
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
          rankDivision: "",
          isPublic: false,
        };
      }
    } catch (e) {
      console.log(`ERROR: ${e}`);
      console.log(playerEntry);
    }
  };

  const getModeName = (mode) => {
    switch (mode) {
      case 43:
        return "Iron Banner Control";
      case 89:
        return "Competitive Collision (3v3 Control)";
      case 71:
        return "Competitive Clash (3v3)";
      case 84:
        return "Trials Of Osiris";
      case 31:
        return "Heavy Metal";
      default:
        return `tell lazy dev to add ${mode}`;
    }
  };

  const gatherPGCRs = async (profile) => {
    let instances = profile.instances;
    let PGCRs = [];
    const baseConfig = {
      method: "get",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    };

    await Promise.all(
      instances.map(async (instance) => {
        let response = await axios({
          ...baseConfig,
          url: `${API_CALLS.COMMON_URL}/Destiny2/Stats/PostGameCarnageReport/${instance.instanceId}`,
        });
        return { ...response, personalStanding: instance.personalStanding };
      })
    ).then(async (responses) => {
      let chunkedResponses = _.chunk(responses, 2);
      await Promise.all(
        chunkedResponses.map(async (responses) => {
          for (let response of responses) {
            let teams = [];
            const mode = response.data.Response.activityDetails.mode;
            const playerEntries = response.data.Response.entries;
            const teamOnePlayers = [];
            const teamTwoPlayers = [];
            let period = response.data.Response.period;
            let modeName = getModeName(mode);
            const mapName =
              compMapNames[response.data.Response.activityDetails.referenceId];
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

              for (let playerEntry of playerEntries) {
                const isPublic = playerEntry.player.destinyUserInfo.isPublic;
                //TODO: fix this so it is more optimized and does not rely on teamOne and teamTwo but instead uses teamIds
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
                        kdr: playerEntry.values.killsDeathsRatio.basic
                          .displayValue,
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
                        kdr: playerEntry.values.killsDeathsRatio.basic
                          .displayValue,
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
                          assists:
                            playerEntry.values.assists.basic.displayValue,
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
                          assists:
                            playerEntry.values.assists.basic.displayValue,
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
                          assists:
                            playerEntry.values.assists.basic.displayValue,
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
                          assists:
                            playerEntry.values.assists.basic.displayValue,
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
                personalStanding: response.personalStanding,
                mapName,
                period,
                modeName,
                teams: consolidatedTeams,
              });
            } catch (e) {
              console.log(`ERROR: ${e}`);
              console.log(response);
            }
          }
        })
      );
    });
    return {
      ...profile,
      PGCRs,
    };
  };

  const genTables = (team) => {
    {
      return mobileLayout
        ? team.players.map((player, index) => (
            <tr
              key={
                index +
                10 /*TODO:possibly do membershipId if available without additional lookup, if not then do instanceId + playerName*/
              }
            >
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
                        height="50rem"
                        width="50rem"
                      ></img>
                      <p style={{ fontSize: "0.5rem", marginBottom: "0" }}>
                        {player.rank.rankDivision}
                      </p>
                      <p style={{ fontSize: "0.5rem" }}>
                        {player.rank.progress}
                      </p>
                    </div>
                  )
                ) : (
                  "Private profile"
                )}
              </td>
              <td style={{ overflowWrap: "anywhere" }}>
                {player.bungieGlobalDisplayName}
              </td>
              <td>{player.kills}</td>
              <td>{player.deaths}</td>
              <td>{player.kdr}</td>
            </tr>
          ))
        : team.players.map((player, index) => (
            <tr
              key={
                index +
                100000000 /* possibly do membershipId if available without additional lookup, if not then do instanceId + playerName*/
              }
            >
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
                      <p style={{ fontSize: "1rem", marginBottom: "0" }}>
                        {player.rank.rankDivision}
                      </p>
                      <p style={{ fontSize: "1rem" }}>{player.rank.progress}</p>
                    </div>
                  )
                ) : (
                  "Private profile"
                )}
              </td>
              <td style={{ overflowWrap: "anywhere" }}>
                {player.bungieGlobalDisplayName}
              </td>
              <td>{player.kills}</td>
              <td>{player.deaths}</td>
              <td>{player.assists}</td>
              <td>{player.kdr}</td>
            </tr>
          ));
    }
  };
  const finalizePGCRs = (payload) => {
    const accordionItems = _.orderBy(payload.PGCRs, "period", "desc").map(
      (PGCR, index) => {
        const teamTables = PGCR.teams.map((team, index) => {
          return mobileLayout ? (
            <div style={{ fontSize: "1rem" }}>
              <h1 align="center">{team.standing.standing}</h1>
              <h1 align="center">{team.standing.score}</h1>
              <Table
                striped
                bordered
                size="sm"
                key={index + 1000000000}
                style={{
                  maxWidth: "100vw",
                  tableLayout: "fixed",
                  fontSize: "0.75rem",
                }}
              >
                <thead>
                  <tr
                    key={
                      index +
                      100 /* possibly do membershipId if available without additional lookup, if not then do instanceId + playerName*/
                    }
                  >
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Kills</th>
                    <th>Deaths</th>
                    <th>KD</th>
                  </tr>
                </thead>
                <tbody>{genTables(team)}</tbody>
              </Table>
            </div>
          ) : (
            <div className="col-6">
              <h1 align="center">{team.standing.standing}</h1>
              <h1 align="center">{team.standing.score}</h1>
              <Table
                striped
                bordered
                size="sm"
                class="--bs-success"
                key={index + 1000000000 /* possibly do teamId + instanceId*/}
                style={{ maxWidth: "90vw" }}
              >
                <thead>
                  <tr
                    key={
                      index +
                      100 /* possibly do membershipId if available without additional lookup, if not then do instanceId + playerName*/
                    }
                    style={{ maxWidth: "90vw" }}
                  >
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Kills</th>
                    <th>Deaths</th>
                    <th>Assists</th>
                    <th>KD</th>
                  </tr>
                </thead>
                <tbody>{genTables(team)}</tbody>
              </Table>
            </div>
          );
        });
        return (
          <Accordion.Item eventKey={index} key={index}>
            <Accordion.Header>
              {PGCR.personalStanding === "Defeat" ? (
                <div>
                  <span className="text-danger">{PGCR.personalStanding}</span> -{" "}
                  {PGCR.mapName} - {PGCR.modeName} -{" "}
                  {new Date(PGCR.period).toLocaleString()}
                </div>
              ) : (
                <div>
                  <span className="text-success">{PGCR.personalStanding}</span>{" "}
                  - {PGCR.mapName} - {PGCR.modeName} -{" "}
                  {new Date(PGCR.period).toLocaleString()}
                </div>
              )}
            </Accordion.Header>
            <Accordion.Body key={index + 100000}>
              <Row>{teamTables}</Row>
            </Accordion.Body>
          </Accordion.Item>
        );
      }
    );
    setpgcrItems(accordionItems);
  };

  const handleClick = async () => {
    if (!regEx.test(bungieId)) {
      setinvalidText(
        <div className="text-danger">
          Please Enter a valid bungie ID that follows the format of My Bungie
          ID#1234.
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
      {mobileLayout ? (
        <div align="center">
          <Form.Label>Enter Bungie ID to see competitive crucible match history</Form.Label>
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
            <Accordion key="unique" style={{ marginTop: "1rem" }}>
              {pgcrItems}
            </Accordion>
          ) : player?.isPublic === undefined ? (
            <div></div>
          ) : (
            <div>
              Bungie Profile is set to private. Unable to display stats for this
              player.
            </div>
          )}
        </div>
      ) : (
        <Row className="mb-3">
          <Col xs={3}>
            <Form.Label>
              Enter Bungie ID to see competitive crucible match history
            </Form.Label>
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
            {/* <div>TODO: This is placeholder until I can add in more text to describe what this website is and how to ask for bug issues to resolved</div> */}
          </Col>
          <Col xs={9}>
            {loading ? (
              <div>
                Loading <Spinner animation="border" size="sm" />
              </div>
            ) : player?.isPublic ? (
              <Accordion key="PGCR Matches">{pgcrItems}</Accordion>
            ) : player?.isPublic === undefined ? (
              <div></div>
            ) : (
              <div>
                Bungie Profile is set to private. Unable to display stats for
                this player.
              </div>
            )}
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default CompetetiveStats;
