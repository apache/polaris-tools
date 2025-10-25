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
import { Link } from 'react-router-dom';
import { Breadcrumb, Card, Space, Button, Popconfirm } from 'antd';
import { HomeOutlined, UserOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

export default function Principals(props) {

    const fetchPrincipals = () => {
        fetch('/api/management/v1/principals', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',

            }
        })
    };

    const principalColumns = [
        {
            title: 'Principal',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: 'Client ID',
            dataIndex: 'clientId',
            key: 'clientId'
        },
        {
            title: '',
            key: 'action',
            render: (_,record) => (
                <Space>
                    <Button><EditOutlined/></Button>
                    <Popconfirm title="Delete Principal"
                        description="Are you sure you want to delete this principal ?"
                        okText="Yes" cancelText="No">
                        <Button danger icon={<DeleteOutlined/>} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return(
        <>
        <Breadcrumb items={[ { title: <Link to="/"><HomeOutlined/></Link> }, { title: <UserOutlined/> } ]} />
        <Card title="Principals" style={{ width: '100%' }}>

        </Card>
        </>
    );

}