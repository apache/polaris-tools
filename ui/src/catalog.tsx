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
import { Breadcrumb, Card, Form, Input, Tabs, Collapse, Divider, Button, Space } from 'antd';
import { HomeOutlined, ApartmentOutlined, AmazonOutlined, GoogleOutlined, CloudOutlined, FileSyncOutlined, SaveOutlined, PauseCircleOutlined } from '@ant-design/icons';

export default function Catalog(props) {

    const [ catalogForm ] = Form.useForm();

    const tabItems = [
        {
            key: 's3',
            label: 'AWS S3',
            icon: <AmazonOutlined/>,
            children: <p>S3</p>
        },
        {
            key: 'gcp',
            label: 'GCP',
            icon: <GoogleOutlined/>,
            children: <p>GCP</p>
        },
        {
            key: 'azure',
            label: 'Azure',
            icon: <CloudOutlined/>,
            children: <p>Azure</p>
        },
        {
            key: 'local',
            label: 'Local',
            icon: <FileSyncOutlined/>,
            children: <p>File</p>
        }
    ];

    return(
      <>
      <Breadcrumb items={[ { title: <Link to="/"><HomeOutlined/></Link> }, { title: <ApartmentOutlined/> } ]} />
      <Card title="Create Catalog" style={{ width: '100%' }}>
        <Form name="catalog" form={catalogForm} labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            style={{ width: '100%' }}>
            <Form.Item name="name" label="Name">
                <Input allowClear={true} />
            </Form.Item>
            <Form.Item name="location" label="Default Base Location">
                <Input allowClear={true} />
            </Form.Item>
            <Divider/>
            <Tabs centered items={tabItems} />
            <Divider/>
            <Collapse items={[
                { key: '1', label: 'Properties', children: <p>Properties</p> }
            ]}/>
            <Divider/>
            <Form.Item label={null}>
                <Space>
                    <Button type="primary" icon={<SaveOutlined/>}>Save</Button>
                    <Button icon={<PauseCircleOutlined/>}>Cancel</Button>
                </Space>
            </Form.Item>
        </Form>
      </Card>
      </>
    );

}