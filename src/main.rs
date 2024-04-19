// use reqwest::Error;

// #[tokio::main]
// async fn main () {
//     read_channels().await;
// }

// //  -> Result<(), Error>

// async fn read_channels() -> Result<(), Error> {
//     let request_url = "https://api.hubapi.com/conversations/v3/conversations/channels";
//     println!("{}", request_url);

//     let client = reqwest::Client::new();

//     match client.get(request_url).send().await {
//         Ok(resp) => {
//             let json = resp.json().await?;
//             println!("{:?}", json)
//         }
//         Err(err) => {
//             println!("Reqwest Error: {}", err)
//         }

//         Ok(())
//     }
//     // let response = client.get("https://api.hubapi.com/conversations/v3/conversations/channels").bearer_auth(token).send().await;


//     // // let channels = response.json().await?;
//     // println!("{:?}", response);

//     Ok(())
// }

use std::env;
use reqwest;
use serde_json;
use serde::{Deserialize, Serialize};
// use std::collections::HashMap;
use colored::Colorize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct GenericValidResponse<T> {
    data: T,
}

#[derive(Debug, Deserialize)]
struct ErrorResponse {
    category: String,
    correlationId: String,
    message: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct Channels {
    results: Vec<Channel>,
    total: usize
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ChannelsResponse {
    Error(ErrorResponse),
    Success(Channels),
    UnexpectedResponse(Value)
}

#[derive(Debug, Deserialize)]
struct Channel {
    id: String,
    name: String,
}

// #[derive(Debug, Deserialize)]
// #[serde(untagged)]
// enum GenericResponse {
//     Error(ErrorResponse),
//     Success(GenericValidResponse<Value>)
// }


#[tokio::main]
async fn main() {

    // let args: Vec<String> = env::args().collect();
    // let token = &args[1];
    let token = "foo";

    println!("TOKEN: {}", token);

    let channels_response = match api_read_channels(token).await {
        Ok(api_response) => api_response,
        Err(err) => {
            eprintln!("Error calling first API: {:?}", err);
            return;
        }
    };

    

    // match api_read_channels(token).await {
    //     Ok(api_response) => match api_response {
    //         ChannelsResponse::Success(valid_response) => {
    //             println!("valid response: {:?}", valid_response)
    //         }
    //         ChannelsResponse::Error(error_response) => {
    //             println!("{}: {}", error_response.category.bold().red(), error_response.message.red())
    //         }
    //         ChannelsResponse::UnexpectedResponse(error_response) => {
    //             println!("Unexpected, Debug: {}", error_response.to_string().yellow())
    //         }
    //     },
    //     Err(err) => eprintln!("Error calling first API: {:?}", err),
    // }


    return ()
}

async fn api_read_channels(token: &str) -> Result<ChannelsResponse, reqwest::Error> {

    let client = reqwest::Client::new();

    // UNKNOWN RETURN - serde_json::Value
    const URL: &str = "https://api.hubapi.com/conversations/v3/conversations/channels";
    let response = client.get(URL).bearer_auth(token).send().await?;
    let api_response = response.json().await?;
    // println!("{:?}", api_response);
    Ok(api_response)
}
