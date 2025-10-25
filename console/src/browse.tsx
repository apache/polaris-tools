/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/
import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { Breadcrumb, Card, Space, Tree, Row, Col, Spin, message } from 'antd';
import { HomeOutlined, ApartmentOutlined } from '@ant-design/icons';

function Detail(props) {

    return(
      <b>{ props.item }</b>
    );

}

export default function Browse(props) {

    const [ browseTree, setBrowseTree ] = useState();
    const [ item, setItem ] = useState();

    const bearer = 'Bearer ' + props.token;
    const realmHeader = props.realmHeader;
    const realm = props.realm;

    let { catalogName } = useParams();

    const browse = () => {
        fetch('/api/catalog/v1/' + catalogName + '/namespaces', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                realmHeader: realm,
                'Authorization': bearer
            }
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error(response.status);
            }
            return response.json();
        })
        .then((data) => {
            setBrowseTree(data);
        })
        .catch((error) => {
            message.error('An error occurred: ' + error.message);
            console.error(error);
        })
    };

    useEffect(browse, [catalogName]);

    if (!browseTree) {
        return(<Spin/>);
    }

    let treeData = [
        {
            title: catalogName,
            key: catalogName,
            children: browseTree.namespaces
        }
    ];

    return(
        <>
        <Breadcrumb items={[ { title: <Link to="/"><HomeOutlined/></Link> }, { title: <ApartmentOutlined/> } ]} />
        <Card title={<Space><ApartmentOutlined/> {catalogName}</Space>} style={{ width: '100%' }} >
            <Row>
                <Col span="12">
                    <Tree treeData={treeData} onClick={(e) => console.log(e)} />
                </Col>
                <Col span="12">
                    <Detail item={item} />
                </Col>
            </Row>
        </Card>
        </>
    );
}